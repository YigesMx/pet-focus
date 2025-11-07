use serde::Deserialize;
use tauri::{Emitter, State};

use super::{
    models::todo::Todo,
    services::{
        pomorodo_service::{self, PomodoroSettings},
        setting_service::SettingService,
        todo_service,
    },
};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use super::webserver::WebServerStatus;
use crate::AppState;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
const WEBSERVER_STATUS_CHANGED_EVENT: &str = "webserver-status-changed";
const TIMER_SETTINGS_CHANGED_EVENT: &str = "timer-settings-changed";
const POMODORO_COUNT_CHANGED_EVENT: &str = "pomodoro-count-changed";

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

#[derive(Debug, Deserialize)]
pub struct UpdateTodoDueDatePayload {
    pub id: i32,
    pub due_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTodoRemindBeforePayload {
    pub id: i32,
    pub remind_before_minutes: i32,
}

#[derive(Debug, Deserialize)]
pub struct SetTimerSettingsPayload {
    pub work_duration: u32,
    pub short_break_duration: u32,
    pub long_break_duration: u32,
    pub long_break_interval: u32,
}

#[tauri::command]
pub async fn list_todos(state: State<'_, AppState>) -> Result<Vec<Todo>, String> {
    todo_service::list_todos(state.db())
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn create_todo(
    state: State<'_, AppState>,
    payload: Option<CreateTodoPayload>,
) -> Result<Todo, String> {
    let title = payload.and_then(|payload| payload.title);

    let result = todo_service::create_todo(state.db(), title)
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
    let result = todo_service::update_todo(state.db(), payload.id, payload.title, payload.completed)
        .await
        .map_err(|err| err.to_string())?;

    // 统一的变更通知（会自动触发 reschedule）
    state.notify_todo_change("updated", Some(payload.id)).await;

    Ok(result)
}

#[tauri::command]
pub async fn delete_todo(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    todo_service::delete_todo(state.db(), id)
        .await
        .map_err(|err| err.to_string())?;

    // 统一的变更通知（会自动触发 reschedule）
    state.notify_todo_change("deleted", Some(id)).await;

    Ok(())
}

#[tauri::command]
pub async fn update_todo_due_date(
    state: State<'_, AppState>,
    payload: UpdateTodoDueDatePayload,
) -> Result<Todo, String> {
    let result = todo_service::update_todo_due_date(state.db(), payload.id, payload.due_date)
        .await
        .map_err(|err| err.to_string())?;

    // 统一的变更通知（会自动触发 reschedule）
    state.notify_todo_change("updated", Some(payload.id)).await;

    Ok(result)
}

#[tauri::command]
pub async fn update_todo_remind_before(
    state: State<'_, AppState>,
    payload: UpdateTodoRemindBeforePayload,
) -> Result<Todo, String> {
    let result = todo_service::update_todo_remind_before(state.db(), payload.id, payload.remind_before_minutes)
        .await
        .map_err(|err| err.to_string())?;

    // 统一的变更通知（会自动触发 reschedule）
    state.notify_todo_change("updated", Some(payload.id)).await;

    Ok(result)
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
        let _ = state.app_handle().emit(WEBSERVER_STATUS_CHANGED_EVENT, true);
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
        let _ = state.app_handle().emit(WEBSERVER_STATUS_CHANGED_EVENT, false);
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

// --- Pomodoro settings commands ---

#[tauri::command]
pub async fn get_timer_settings(state: State<'_, AppState>) -> Result<PomodoroSettings, String> {
    pomorodo_service::get_settings(state.db())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_timer_settings(
    state: State<'_, AppState>,
    payload: SetTimerSettingsPayload,
) -> Result<PomodoroSettings, String> {
    let settings = PomodoroSettings {
        work_duration: payload.work_duration,
        short_break_duration: payload.short_break_duration,
        long_break_duration: payload.long_break_duration,
        long_break_interval: payload.long_break_interval,
    };

    let saved = pomorodo_service::set_settings(state.db(), settings)
        .await
        .map_err(|e| e.to_string())?;

    // Apply to runtime state after saving
    pomorodo_service::apply_settings_to_state(state.db(), state.timer())
        .await
        .map_err(|e| e.to_string())?;

    // Notify frontend to refresh settings/UI
    let _ = state
        .app_handle()
        .emit(TIMER_SETTINGS_CHANGED_EVENT, &saved);

    Ok(saved)
}

#[tauri::command]
pub async fn get_pomodoro_count(state: State<'_, AppState>) -> Result<u32, String> {
    pomorodo_service::get_pomodoro_count(state.db())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_pomodoro_count(state: State<'_, AppState>, count: u32) -> Result<(), String> {
    pomorodo_service::set_pomodoro_count(state.db(), count)
        .await
        .map_err(|e| e.to_string())?;

    // Notify frontend about count change
    let _ = state
        .app_handle()
        .emit(POMODORO_COUNT_CHANGED_EVENT, &count);

    Ok(())
}
