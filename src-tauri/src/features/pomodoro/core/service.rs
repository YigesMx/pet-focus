use anyhow::Result;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};

use crate::features::settings::core::service::SettingService;

use super::models::{PomodoroConfig, PomodoroSessionKind, PomodoroSessionStatus};
use crate::features::pomodoro::data::entities::{
    pomodoro_records as record_entity, pomodoro_sessions as session_entity,
};
use chrono::{DateTime, Utc};
use sea_orm::{
    ActiveModelTrait,
    ActiveValue::{NotSet, Set},
    ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder, QuerySelect,
};

const KEY_FOCUS: &str = "pomodoro.focus_minutes";
const KEY_SHORT: &str = "pomodoro.short_break_minutes";
const KEY_LONG: &str = "pomodoro.long_break_minutes";
const KEY_INTERVAL: &str = "pomodoro.long_break_interval";

pub async fn get_config(db: &DatabaseConnection) -> Result<PomodoroConfig> {
    let mut cfg = PomodoroConfig::default();

    let focus =
        SettingService::get_or_default(db, KEY_FOCUS, &cfg.focus_minutes.to_string()).await?;
    cfg.focus_minutes = focus.parse::<u32>().unwrap_or(cfg.focus_minutes);

    let short_b =
        SettingService::get_or_default(db, KEY_SHORT, &cfg.short_break_minutes.to_string()).await?;
    cfg.short_break_minutes = short_b.parse::<u32>().unwrap_or(cfg.short_break_minutes);

    let long_b =
        SettingService::get_or_default(db, KEY_LONG, &cfg.long_break_minutes.to_string()).await?;
    cfg.long_break_minutes = long_b.parse::<u32>().unwrap_or(cfg.long_break_minutes);

    let interval =
        SettingService::get_or_default(db, KEY_INTERVAL, &cfg.long_break_interval.to_string())
            .await?;
    cfg.long_break_interval = interval.parse::<u32>().unwrap_or(cfg.long_break_interval);

    Ok(cfg)
}

pub async fn set_config(db: &DatabaseConnection, cfg: PomodoroConfig) -> Result<()> {
    SettingService::set(db, KEY_FOCUS, &cfg.focus_minutes.to_string()).await?;
    SettingService::set(db, KEY_SHORT, &cfg.short_break_minutes.to_string()).await?;
    SettingService::set(db, KEY_LONG, &cfg.long_break_minutes.to_string()).await?;
    SettingService::set(db, KEY_INTERVAL, &cfg.long_break_interval.to_string()).await?;
    Ok(())
}

// ==================== Record Operations (兼容性接口) ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroStats {
    pub total_focus_seconds: i64,
    pub session_count: i64,
}

/// 获取指定时间范围内的统计数据
pub async fn get_stats_range(
    db: &DatabaseConnection,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<PomodoroStats> {
    // 查询所有专注时间的秒数
    let rows: Vec<i32> = record_entity::Entity::find()
        .filter(record_entity::Column::Kind.eq("focus"))
        .filter(record_entity::Column::Status.eq("completed"))
        .filter(record_entity::Column::StartAt.gte(from))
        .filter(record_entity::Column::EndAt.lte(to))
        .select_only()
        .column(record_entity::Column::ElapsedSeconds)
        .into_tuple()
        .all(db)
        .await?;
    let total_focus: i64 = rows.into_iter().map(|v| v as i64).sum();

    // 计数专注记录
    let session_count: i64 = record_entity::Entity::find()
        .filter(record_entity::Column::Kind.eq("focus"))
        .filter(record_entity::Column::Status.eq("completed"))
        .filter(record_entity::Column::StartAt.gte(from))
        .filter(record_entity::Column::EndAt.lte(to))
        .count(db)
        .await
        .map(|c| c as i64)?;

    Ok(PomodoroStats {
        total_focus_seconds: total_focus,
        session_count,
    })
}

/// 列出最近的 records（按时间倒序）
pub async fn list_recent_records(
    db: &DatabaseConnection,
    limit: u64,
) -> Result<Vec<record_entity::Model>> {
    let items = record_entity::Entity::find()
        .order_by_desc(record_entity::Column::StartAt)
        .limit(limit)
        .all(db)
        .await?;
    Ok(items)
}

/// 删除单个 record
pub async fn delete_record(db: &DatabaseConnection, record_id: i32) -> Result<()> {
    record_entity::Entity::delete_by_id(record_id)
        .exec(db)
        .await?;
    Ok(())
}

// ==================== Session Management ====================

/// 创建新的 Session
pub async fn create_session(
    db: &DatabaseConnection,
    note: Option<String>,
) -> Result<session_entity::Model> {
    let now = Utc::now();
    let active = session_entity::ActiveModel {
        id: NotSet,
        note: Set(note),
        archived: Set(false),
        archived_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };
    Ok(active.insert(db).await?)
}

/// 获取指定 Session
pub async fn get_session_by_id(
    db: &DatabaseConnection,
    session_id: i32,
) -> Result<Option<session_entity::Model>> {
    Ok(session_entity::Entity::find_by_id(session_id)
        .one(db)
        .await?)
}

/// 获取所有 Sessions
pub async fn list_sessions(
    db: &DatabaseConnection,
    include_archived: bool,
) -> Result<Vec<session_entity::Model>> {
    let mut query = session_entity::Entity::find().order_by_desc(session_entity::Column::CreatedAt);

    if !include_archived {
        query = query.filter(session_entity::Column::Archived.eq(false));
    }

    Ok(query.all(db).await?)
}

/// 更新 Session 备注
pub async fn update_session_note(
    db: &DatabaseConnection,
    session_id: i32,
    note: Option<String>,
) -> Result<session_entity::Model> {
    let session = session_entity::Entity::find_by_id(session_id)
        .one(db)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Session not found"))?;

    let mut active: session_entity::ActiveModel = session.into();
    active.note = Set(note);
    active.updated_at = Set(Utc::now());

    Ok(active.update(db).await?)
}

/// 归档 Session
pub async fn archive_session(
    db: &DatabaseConnection,
    session_id: i32,
) -> Result<session_entity::Model> {
    let session = session_entity::Entity::find_by_id(session_id)
        .one(db)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Session not found"))?;

    let mut active: session_entity::ActiveModel = session.into();
    active.archived = Set(true);
    active.archived_at = Set(Some(Utc::now()));
    active.updated_at = Set(Utc::now());

    Ok(active.update(db).await?)
}

/// 删除 Session（通过数据库外键约束自动级联删除关联的 records）
pub async fn delete_session_cascade(db: &DatabaseConnection, session_id: i32) -> Result<()> {
    // 由于外键约束设置了 ON DELETE CASCADE，删除 session 时会自动删除所有关联的 records
    session_entity::Entity::delete_by_id(session_id)
        .exec(db)
        .await?;
    Ok(())
}

/// 获取活动的 Session（最新的未归档 session），不自动创建
pub async fn get_active_session(db: &DatabaseConnection) -> Result<Option<session_entity::Model>> {
    let active = session_entity::Entity::find()
        .filter(session_entity::Column::Archived.eq(false))
        .order_by_desc(session_entity::Column::CreatedAt)
        .one(db)
        .await?;

    Ok(active)
}

/// 获取或创建活动的 Session（最新的未归档 session）
/// 注意：这个函数会在没有 session 时自动创建，应该只在创建 record 时调用
///
/// # 参数
/// - `pending_note`: 如果需要创建新 session，使用此备注
pub async fn get_or_create_active_session(
    db: &DatabaseConnection,
    pending_note: Option<String>,
) -> Result<session_entity::Model> {
    let active = get_active_session(db).await?;

    match active {
        Some(session) => Ok(session),
        None => create_session(db, pending_note).await,
    }
}

/// 获取 Session 的所有 Records（按创建时间排序）
pub async fn list_session_records(
    db: &DatabaseConnection,
    session_id: i32,
) -> Result<Vec<record_entity::Model>> {
    let records = record_entity::Entity::find()
        .filter(record_entity::Column::SessionId.eq(session_id))
        .order_by_asc(record_entity::Column::CreatedAt)
        .all(db)
        .await?;

    Ok(records)
}

/// 创建 Record 并关联到 Session
pub async fn create_record_with_session(
    db: &DatabaseConnection,
    session_id: i32,
    kind: PomodoroSessionKind,
    status: PomodoroSessionStatus,
    round: u32,
    start_at: DateTime<Utc>,
    end_at: DateTime<Utc>,
    related_todo_id: Option<i32>,
) -> Result<record_entity::Model> {
    let elapsed = (end_at - start_at).num_seconds().max(0) as i32;
    let now = Utc::now();

    let active = record_entity::ActiveModel {
        id: NotSet,
        session_id: Set(session_id),
        kind: Set(match kind {
            PomodoroSessionKind::Focus => "focus".into(),
            PomodoroSessionKind::Rest => "rest".into(),
        }),
        status: Set(match status {
            PomodoroSessionStatus::Completed => "completed".into(),
            PomodoroSessionStatus::Stopped => "stopped".into(),
            PomodoroSessionStatus::Skipped => "skipped".into(),
        }),
        round: Set(round as i32),
        start_at: Set(start_at),
        end_at: Set(end_at),
        elapsed_seconds: Set(elapsed),
        related_todo_id: Set(related_todo_id),
        created_at: Set(now),
        updated_at: Set(now),
    };

    Ok(active.insert(db).await?)
}

/// 生成 Session 动态标题
/// 格式: "年月日时分～时分" (同一天) 或 "年月日时分～年月日时分" (跨天)
pub async fn generate_session_title(db: &DatabaseConnection, session_id: i32) -> Result<String> {
    let records = list_session_records(db, session_id).await?;

    if records.is_empty() {
        return Ok("空 Session".to_string());
    }

    let first_start = records.first().unwrap().start_at;
    let last_end = records.last().unwrap().end_at;

    let start_str = first_start.format("%Y-%m-%d %H:%M").to_string();

    // 检查是否是同一天
    let same_day = first_start.date_naive() == last_end.date_naive();

    if same_day {
        let end_time = last_end.format("%H:%M").to_string();
        Ok(format!("{} ～ {}", start_str, end_time))
    } else {
        let end_str = last_end.format("%Y-%m-%d %H:%M").to_string();
        Ok(format!("{} ～ {}", start_str, end_str))
    }
}

// ==================== Settings for Time Adjustment ====================

const KEY_LAST_FOCUS_MINUTES: &str = "pomodoro.last_focus_minutes";
const KEY_LAST_REST_MINUTES: &str = "pomodoro.last_rest_minutes";

/// 保存上次调整的时间配置
pub async fn save_last_adjusted_times(
    db: &DatabaseConnection,
    focus_minutes: Option<u32>,
    rest_minutes: Option<u32>,
) -> Result<()> {
    if let Some(f) = focus_minutes {
        SettingService::set(db, KEY_LAST_FOCUS_MINUTES, &f.to_string()).await?;
    }
    if let Some(r) = rest_minutes {
        SettingService::set(db, KEY_LAST_REST_MINUTES, &r.to_string()).await?;
    }
    Ok(())
}

/// 获取上次调整的时间配置
pub async fn get_last_adjusted_times(
    db: &DatabaseConnection,
) -> Result<(Option<u32>, Option<u32>)> {
    let focus = match SettingService::get(db, KEY_LAST_FOCUS_MINUTES).await? {
        Some(s) => s.parse::<u32>().ok(),
        None => None,
    };
    let rest = match SettingService::get(db, KEY_LAST_REST_MINUTES).await? {
        Some(s) => s.parse::<u32>().ok(),
        None => None,
    };

    Ok((focus, rest))
}
