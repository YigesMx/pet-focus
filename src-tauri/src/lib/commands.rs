use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use super::webserver::WebServerStatus;
use super::{
    models::todo::Todo,
    services::{
        caldav::{CalDavConfig, CalDavConfigService, CalDavSyncEvent, SyncReason},
        setting_service::SettingService,
        todo,
    },
};
use crate::AppState;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
const WEBSERVER_STATUS_CHANGED_EVENT: &str = "webserver-status-changed";
const THEME_DEFAULT: &str = "system";

#[derive(Debug, Default, Deserialize)]
pub struct CreateTodoPayload {
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTodoPayload {
    pub id: i32,
    pub title: Option<String>,
    pub completed: Option<bool>,
}

#[derive(Debug, Default, Deserialize)]
pub struct UpdateTodoDetailsPayload {
    pub id: i32,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub location: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub start_at: Option<String>,
    pub due_date: Option<String>,
    pub recurrence_rule: Option<String>,
    pub reminder_offset_minutes: Option<i32>,
    pub reminder_method: Option<String>,
    pub timezone: Option<String>,
}

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

#[derive(Debug, Serialize)]
pub struct ThemePreference {
    pub theme: String,
}

#[tauri::command]
pub async fn list_todos(state: State<'_, AppState>) -> Result<Vec<Todo>, String> {
    todo::list_todos(state.db())
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn create_todo(
    state: State<'_, AppState>,
    payload: Option<CreateTodoPayload>,
) -> Result<Todo, String> {
    let title = payload.and_then(|payload| payload.title);

    let result = todo::create_todo(state.db(), title)
        .await
        .map_err(|err| err.to_string())?;

    // 统一的变更通知（会自动触发 reschedule）
    state.notify_todo_change("created", Some(result.id)).await;

    Ok(result)
}

#[tauri::command]
pub async fn update_todo(
    state: State<'_, AppState>,
    payload: UpdateTodoPayload,
) -> Result<Todo, String> {
    let result = todo::update_todo(state.db(), payload.id, payload.title, payload.completed)
        .await
        .map_err(|err| err.to_string())?;

    // 统一的变更通知（会自动触发 reschedule）
    state.notify_todo_change("updated", Some(payload.id)).await;

    Ok(result)
}

#[tauri::command]
pub async fn delete_todo(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    todo::delete_todo(state.db(), id)
        .await
        .map_err(|err| err.to_string())?;

    // 统一的变更通知（会自动触发 reschedule）
    state.notify_todo_change("deleted", Some(id)).await;

    Ok(())
}

#[tauri::command]
pub async fn update_todo_details(
    state: State<'_, AppState>,
    payload: UpdateTodoDetailsPayload,
) -> Result<Todo, String> {
    let result = todo::update_todo_details(
        state.db(),
        payload.id,
        payload.description,
        payload.priority,
        payload.location,
        payload.tags,
        payload.start_at,
        payload.due_date,
        payload.recurrence_rule,
        payload.reminder_offset_minutes,
        payload.reminder_method,
        payload.timezone,
    )
    .await
    .map_err(|err| err.to_string())?;

    state.notify_todo_change("updated", Some(payload.id)).await;

    Ok(result)
}

#[tauri::command]
pub async fn get_caldav_status(state: State<'_, AppState>) -> Result<CalDavStatus, String> {
    caldav_status(state.inner()).await
}

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
        .map_err(|err| err.to_string())?;
    CalDavConfigService::set_last_sync(state.db(), None)
        .await
        .map_err(|err| err.to_string())?;

    state.caldav().trigger(SyncReason::ConfigUpdated);

    caldav_status(state.inner()).await
}

#[tauri::command]
pub async fn clear_caldav_config(state: State<'_, AppState>) -> Result<CalDavStatus, String> {
    CalDavConfigService::clear_config(state.db())
        .await
        .map_err(|err| err.to_string())?;

    // 清理所有待删除的 todo（因为没有 CalDAV 配置，它们无法完成同步删除）
    todo::cleanup_pending_deletes(state.db())
        .await
        .map_err(|err| err.to_string())?;

    state.caldav().trigger(SyncReason::ConfigUpdated);

    caldav_status(state.inner()).await
}

#[tauri::command]
pub async fn sync_caldav_now(state: State<'_, AppState>) -> Result<CalDavSyncEvent, String> {
    state
        .caldav()
        .sync_now(SyncReason::Manual)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn get_theme_preference(state: State<'_, AppState>) -> Result<ThemePreference, String> {
    let stored = SettingService::get_or_default(state.db(), "ui.theme", THEME_DEFAULT)
        .await
        .map_err(|err| err.to_string())?;

    let normalized = normalize_theme(&stored).to_string();

    if normalized != stored {
        let _ = SettingService::set(state.db(), "ui.theme", &normalized).await;
    }

    Ok(ThemePreference { theme: normalized })
}

#[tauri::command]
pub async fn set_theme_preference(
    state: State<'_, AppState>,
    theme: String,
) -> Result<ThemePreference, String> {
    let normalized = normalize_theme(&theme).to_string();

    SettingService::set(state.db(), "ui.theme", &normalized)
        .await
        .map_err(|err| err.to_string())?;

    Ok(ThemePreference { theme: normalized })
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
pub async fn start_web_server(state: State<'_, AppState>) -> Result<WebServerStatus, String> {
    let result = state
        .web_server()
        .start(state.db().clone(), state.app_handle(), None)
        .await
        .map_err(|err| err.to_string());

    if result.is_ok() {
        // 保存设置
        let _ = SettingService::set_bool(state.db(), "webserver.auto_start", true).await;

        // 通知托盘菜单更新
        let _ = state
            .app_handle()
            .emit(WEBSERVER_STATUS_CHANGED_EVENT, true);
        // 更新托盘菜单
        let _ = super::tray::update_tray_menu_from_app(&state.app_handle(), true);
    }

    result
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
pub async fn stop_web_server(state: State<'_, AppState>) -> Result<WebServerStatus, String> {
    let result = state
        .web_server()
        .stop()
        .await
        .map_err(|err| err.to_string());

    if result.is_ok() {
        // 保存设置
        let _ = SettingService::set_bool(state.db(), "webserver.auto_start", false).await;

        // 通知托盘菜单更新
        let _ = state
            .app_handle()
            .emit(WEBSERVER_STATUS_CHANGED_EVENT, false);
        // 更新托盘菜单
        let _ = super::tray::update_tray_menu_from_app(&state.app_handle(), false);
    }

    result
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
pub async fn web_server_status(state: State<'_, AppState>) -> Result<WebServerStatus, String> {
    Ok(state.web_server().status().await)
}

fn normalize_theme(value: &str) -> &'static str {
    match value {
        "light" => "light",
        "dark" => "dark",
        _ => THEME_DEFAULT,
    }
}

async fn caldav_status(state: &AppState) -> Result<CalDavStatus, String> {
    let config = CalDavConfigService::get_config(state.db())
        .await
        .map_err(|err| err.to_string())?;
    let last_sync = CalDavConfigService::get_last_sync(state.db())
        .await
        .map_err(|err| err.to_string())?;
    let last_error = CalDavConfigService::get_last_error(state.db())
        .await
        .map_err(|err| err.to_string())?;

    Ok(CalDavStatus {
        configured: config.is_some(),
        url: config.as_ref().map(|cfg| cfg.url.clone()),
        username: config.as_ref().map(|cfg| cfg.username.clone()),
        last_sync_at: last_sync.map(|dt| dt.to_rfc3339()),
        last_error,
        syncing: state.caldav().is_running(),
    })
}
