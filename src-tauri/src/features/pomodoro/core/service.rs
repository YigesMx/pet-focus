use anyhow::Result;
use sea_orm::DatabaseConnection;

use crate::features::settings::core::service::SettingService;

use super::models::{PomodoroConfig, PomodoroSessionKind, PomodoroSessionStatus};
use crate::features::pomodoro::data::entity as session_entity;
use sea_orm::{ActiveModelTrait, ActiveValue::{Set, NotSet}, ColumnTrait, EntityTrait, QueryFilter, QuerySelect, QueryOrder, PaginatorTrait};
use chrono::{DateTime, Utc};

const KEY_FOCUS: &str = "pomodoro.focus_minutes";
const KEY_SHORT: &str = "pomodoro.short_break_minutes";
const KEY_LONG: &str = "pomodoro.long_break_minutes";
const KEY_INTERVAL: &str = "pomodoro.long_break_interval";

pub async fn get_config(db: &DatabaseConnection) -> Result<PomodoroConfig> {
    let mut cfg = PomodoroConfig::default();

    let focus = SettingService::get_or_default(db, KEY_FOCUS, &cfg.focus_minutes.to_string()).await?;
    cfg.focus_minutes = focus.parse::<u32>().unwrap_or(cfg.focus_minutes);

    let short_b = SettingService::get_or_default(db, KEY_SHORT, &cfg.short_break_minutes.to_string()).await?;
    cfg.short_break_minutes = short_b.parse::<u32>().unwrap_or(cfg.short_break_minutes);

    let long_b = SettingService::get_or_default(db, KEY_LONG, &cfg.long_break_minutes.to_string()).await?;
    cfg.long_break_minutes = long_b.parse::<u32>().unwrap_or(cfg.long_break_minutes);

    let interval = SettingService::get_or_default(db, KEY_INTERVAL, &cfg.long_break_interval.to_string()).await?;
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

pub async fn record_session(
    db: &DatabaseConnection,
    kind: PomodoroSessionKind,
    status: PomodoroSessionStatus,
    round: u32,
    start_at: DateTime<Utc>,
    end_at: DateTime<Utc>,
    related_todo_id: Option<i32>,
) -> Result<session_entity::Model> {
    let elapsed = (end_at - start_at).num_seconds().max(0) as i32;
    let now = Utc::now();
    let active = session_entity::ActiveModel {
        id: NotSet,
        kind: Set(match kind { PomodoroSessionKind::Focus => "focus".into(), PomodoroSessionKind::Rest => "rest".into() }),
        status: Set(match status { PomodoroSessionStatus::Completed => "completed".into(), PomodoroSessionStatus::Stopped => "stopped".into(), PomodoroSessionStatus::Skipped => "skipped".into() }),
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

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroStats {
    pub total_focus_seconds: i64,
    pub session_count: i64,
}

pub async fn get_stats_range(db: &DatabaseConnection, from: DateTime<Utc>, to: DateTime<Utc>) -> Result<PomodoroStats> {
    // total focus seconds（在应用端求和，避免聚合别名兼容性问题）
    let rows: Vec<i32> = session_entity::Entity::find()
        .filter(session_entity::Column::Kind.eq("focus"))
        .filter(session_entity::Column::Status.eq("completed"))
        .filter(session_entity::Column::StartAt.gte(from))
        .filter(session_entity::Column::EndAt.lte(to))
        .select_only()
        .column(session_entity::Column::ElapsedSeconds)
        .into_tuple()
        .all(db)
        .await?;
    let total_focus: i64 = rows.into_iter().map(|v| v as i64).sum();

    let session_count: i64 = session_entity::Entity::find()
        .filter(session_entity::Column::Kind.eq("focus"))
        .filter(session_entity::Column::Status.eq("completed"))
        .filter(session_entity::Column::StartAt.gte(from))
        .filter(session_entity::Column::EndAt.lte(to))
        .count(db)
        .await? as i64;

    Ok(PomodoroStats { total_focus_seconds: total_focus, session_count })
}

pub async fn list_recent_sessions(db: &DatabaseConnection, limit: u64) -> Result<Vec<session_entity::Model>> {
    let items = session_entity::Entity::find()
        .order_by_desc(session_entity::Column::StartAt)
        .limit(limit)
        .all(db)
        .await?;
    Ok(items)
}
