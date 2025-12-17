use sea_orm::{ConnectionTrait, DbBackend, Statement};
use tauri::State;

use super::notifications;
use crate::core::AppState;
use crate::features::settings::core::service::SettingService;

#[derive(Debug, serde::Serialize)]
pub struct ThemePreference {
    pub theme: String,
}

const THEME_DEFAULT: &str = "system";

/// 规范化主题值（只支持 light, dark, system）
fn normalize_theme(value: &str) -> &'static str {
    match value {
        "light" => "light",
        "dark" => "dark",
        _ => THEME_DEFAULT,
    }
}

/// 获取主题偏好设置
#[tauri::command]
pub async fn get_theme_preference(state: State<'_, AppState>) -> Result<ThemePreference, String> {
    let stored = SettingService::get_or_default(state.db(), "ui.theme", THEME_DEFAULT)
        .await
        .map_err(|err| err.to_string())?;

    let normalized = normalize_theme(&stored).to_string();

    // 如果存储的值不标准，自动修正
    if normalized != stored {
        let _ = SettingService::set(state.db(), "ui.theme", &normalized).await;
    }

    Ok(ThemePreference { theme: normalized })
}

/// 设置主题偏好
#[tauri::command]
pub async fn set_theme_preference(
    state: State<'_, AppState>,
    theme: String,
) -> Result<ThemePreference, String> {
    let normalized = normalize_theme(&theme).to_string();

    match SettingService::set(state.db(), "ui.theme", &normalized).await {
        Ok(_) => {
            // 发送成功通知
            notifications::notify_theme_updated(state.notification());
            Ok(ThemePreference { theme: normalized })
        }
        Err(err) => {
            // 发送失败通知
            let error_msg = err.to_string();
            notifications::notify_theme_update_failed(state.notification(), &error_msg);
            Err(error_msg)
        }
    }
}

// ============================================================================
// 关闭行为设置
// ============================================================================

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CloseBehavior {
    /// "ask" = 每次询问, "minimize" = 最小化到托盘, "quit" = 退出应用
    pub behavior: String,
}

const CLOSE_BEHAVIOR_DEFAULT: &str = "ask";

/// 规范化关闭行为值（支持 ask, minimize, quit）
fn normalize_close_behavior(value: &str) -> &'static str {
    match value {
        "minimize" => "minimize",
        "quit" => "quit",
        _ => CLOSE_BEHAVIOR_DEFAULT,
    }
}

/// 获取关闭行为设置
#[tauri::command]
pub async fn get_close_behavior(state: State<'_, AppState>) -> Result<CloseBehavior, String> {
    let stored = SettingService::get_or_default(state.db(), "window.close_behavior", CLOSE_BEHAVIOR_DEFAULT)
        .await
        .map_err(|err| err.to_string())?;

    // 不自动修正，保留 "ask" 值
    Ok(CloseBehavior { behavior: stored })
}

/// 设置关闭行为
#[tauri::command]
pub async fn set_close_behavior(
    state: State<'_, AppState>,
    behavior: String,
) -> Result<CloseBehavior, String> {
    let normalized = normalize_close_behavior(&behavior).to_string();

    SettingService::set(state.db(), "window.close_behavior", &normalized)
        .await
        .map(|_| CloseBehavior { behavior: normalized })
        .map_err(|err| err.to_string())
}

// ============================================================================
// 系统通知设置
// ============================================================================

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct NotificationSettings {
    /// 是否启用系统通知
    pub enabled: bool,
}

const NOTIFICATION_ENABLED_DEFAULT: bool = true;

/// 获取系统通知设置
#[tauri::command]
pub async fn get_notification_settings(state: State<'_, AppState>) -> Result<NotificationSettings, String> {
    let stored = SettingService::get_or_default(state.db(), "notification.enabled", "true")
        .await
        .map_err(|err| err.to_string())?;

    let enabled = stored.parse::<bool>().unwrap_or(NOTIFICATION_ENABLED_DEFAULT);
    Ok(NotificationSettings { enabled })
}

/// 设置系统通知开关
#[tauri::command]
pub async fn set_notification_settings(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<NotificationSettings, String> {
    // 保存到数据库
    SettingService::set(state.db(), "notification.enabled", &enabled.to_string())
        .await
        .map_err(|err| err.to_string())?;
    
    // 更新内存缓存
    state.notification().set_notification_enabled(enabled);
    
    Ok(NotificationSettings { enabled })
}

// ============================================================================
// Debug: 清理所有用户数据
// ============================================================================

/// 清理所有用户数据（Debug功能）
/// 删除所有用户生成的数据，包括：
/// - 专注记录、会话
/// - 待办事项
/// - 标签
/// - 成就、金币、统计数据
/// 保留设置数据
#[tauri::command]
pub async fn debug_clear_all_user_data(state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db();
    
    // 需要清理的表（按依赖顺序，先删除有外键引用的表）
    let tables_to_clear = [
        "session_tags",        // 依赖 session 和 tag
        "task_tags",           // 依赖 todo 和 tag  
        "session_todo_links",  // 依赖 session 和 todo
        "pomodoro_records",    // 依赖 session
        "pomodoro_sessions",   // 主表
        "todos",               // 主表
        "tags",                // 主表
        "coin_transactions",   // 依赖 user_stats
        "achievements",        // 主表
        "user_stats",          // 主表
    ];
    
    let mut cleared_tables = Vec::new();
    
    for table in &tables_to_clear {
        let sql = format!("DELETE FROM {}", table);
        match db.execute(Statement::from_string(DbBackend::Sqlite, sql)).await {
            Ok(_) => {
                cleared_tables.push(*table);
            }
            Err(e) => {
                // 表可能不存在，忽略错误
                eprintln!("[debug_clear_all_user_data] Warning: Failed to clear table {}: {}", table, e);
            }
        }
    }
    
    let message = format!("已清理 {} 个数据表: {:?}", cleared_tables.len(), cleared_tables);
    println!("[debug_clear_all_user_data] {}", message);
    
    Ok(message)
}
