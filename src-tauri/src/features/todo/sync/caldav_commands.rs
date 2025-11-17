use serde::{Deserialize, Serialize};
use tauri::State;

use super::{CalDavConfig, CalDavConfigService, CalDavSyncEvent};
use crate::core::AppState;

#[derive(Debug, Deserialize)]
pub struct UpdateCalDavConfigPayload {
    pub url: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct CalDavStatus {
    pub configured: bool,
    pub url: Option<String>,
    pub username: Option<String>,
    pub last_sync_at: Option<String>,
    pub last_error: Option<String>,
    pub syncing: bool,
}

/// 获取 CalDAV 同步状态
#[tauri::command]
pub async fn get_caldav_status(state: State<'_, AppState>) -> Result<CalDavStatus, String> {
    // 获取配置
    let config = CalDavConfigService::get_config(state.db())
        .await
        .map_err(|e| e.to_string())?;

    let (configured, url, username) = if let Some(cfg) = config {
        (true, Some(cfg.url), Some(cfg.username))
    } else {
        (false, None, None)
    };

    // 获取最后同步时间
    let last_sync_at = CalDavConfigService::get_last_sync(state.db())
        .await
        .map_err(|e| e.to_string())?
        .map(|dt| dt.to_rfc3339());

    // 获取最后同步错误
    let last_error = CalDavConfigService::get_last_error(state.db())
        .await
        .map_err(|e| e.to_string())?;

    // 获取同步状态
    let syncing = state.caldav_sync_manager().is_running();

    Ok(CalDavStatus {
        configured,
        url,
        username,
        last_sync_at,
        last_error,
        syncing,
    })
}

/// 保存 CalDAV 配置
#[tauri::command]
pub async fn save_caldav_config(
    state: State<'_, AppState>,
    payload: UpdateCalDavConfigPayload,
) -> Result<CalDavStatus, String> {
    let config = CalDavConfig {
        url: payload.url.trim().to_string(),
        username: payload.username.trim().to_string(),
        password: payload.password,
    };

    if !config.is_valid() {
        return Err("CalDAV 配置信息不完整".to_string());
    }

    CalDavConfigService::set_config(state.db(), &config)
        .await
        .map_err(|e| e.to_string())?;

    CalDavConfigService::set_last_sync(state.db(), None)
        .await
        .map_err(|e| e.to_string())?;

    // 发送成功通知
    crate::features::todo::api::notifications::notify_caldav_config_saved(state.notification());

    // 触发同步
    use super::sync::SyncReason;
    state
        .caldav_sync_manager()
        .trigger(SyncReason::ConfigUpdated);

    get_caldav_status(state).await
}

/// 清除 CalDAV 配置
#[tauri::command]
pub async fn clear_caldav_config(state: State<'_, AppState>) -> Result<CalDavStatus, String> {
    CalDavConfigService::clear_config(state.db())
        .await
        .map_err(|e| e.to_string())?;

    // 清理所有待删除的 todo
    crate::features::todo::core::service::cleanup_pending_deletes(state.db())
        .await
        .map_err(|e| e.to_string())?;

    // 发送成功通知
    crate::features::todo::api::notifications::notify_caldav_config_cleared(state.notification());

    // 触发同步
    use super::sync::SyncReason;
    state
        .caldav_sync_manager()
        .trigger(SyncReason::ConfigUpdated);

    get_caldav_status(state).await
}

/// 立即执行 CalDAV 同步
#[tauri::command]
pub async fn sync_caldav_now(state: State<'_, AppState>) -> Result<CalDavSyncEvent, String> {
    use super::sync::SyncReason;

    state
        .caldav_sync_manager()
        .sync_now(SyncReason::Manual)
        .await
        .map_err(|e| e.to_string())
}

/// 获取 CalDAV 同步间隔（分钟）
#[tauri::command]
pub async fn get_caldav_sync_interval(state: State<'_, AppState>) -> Result<u64, String> {
    CalDavConfigService::get_sync_interval_minutes(state.db())
        .await
        .map_err(|e| e.to_string())
}

/// 设置 CalDAV 同步间隔（分钟）
#[tauri::command]
pub async fn set_caldav_sync_interval(
    state: State<'_, AppState>,
    minutes: u64,
) -> Result<(), String> {
    // 验证范围（最小1分钟，最大1440分钟即24小时）
    if minutes < 1 || minutes > 1440 {
        return Err("同步间隔必须在 1-1440 分钟之间".to_string());
    }

    CalDavConfigService::set_sync_interval_minutes(state.db(), minutes)
        .await
        .map_err(|e| e.to_string())?;

    // 重启调度器使新的间隔立即生效
    state.caldav_sync_manager().restart_scheduler();

    println!("✅ CalDAV 同步间隔已更新为 {} 分钟", minutes);

    Ok(())
}
