use tauri::State;

use crate::core::AppState;
use crate::features::pomodoro::core::{models::PomodoroStatus, service, PomodoroConfig};
use crate::features::pomodoro::data::entities::{
    pomodoro_sessions as session_entity,
    pomodoro_records as record_entity,
};

#[tauri::command]
pub async fn pomodoro_start(state: State<'_, AppState>) -> Result<PomodoroStatus, String> {
    let cfg = service::get_config(state.db()).await.map_err(|e| e.to_string())?;
    let feature = state
        .get_feature("pomodoro")
        .ok_or_else(|| "pomodoro feature not found".to_string())?;
    let feature = feature
        .as_any()
        .downcast_ref::<crate::features::pomodoro::PomodoroFeature>()
        .ok_or_else(|| "invalid pomodoro feature".to_string())?;
    let manager = feature.manager().ok_or_else(|| "pomodoro manager not initialized".to_string())?;
    manager.start(cfg).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pomodoro_pause(state: State<'_, AppState>) -> Result<PomodoroStatus, String> {
    let feature = state
        .get_feature("pomodoro")
        .ok_or_else(|| "pomodoro feature not found".to_string())?;
    let feature = feature
        .as_any()
        .downcast_ref::<crate::features::pomodoro::PomodoroFeature>()
        .ok_or_else(|| "invalid pomodoro feature".to_string())?;
    let manager = feature.manager().ok_or_else(|| "pomodoro manager not initialized".to_string())?;
    Ok(manager.pause().await)
}

#[tauri::command]
pub async fn pomodoro_resume(state: State<'_, AppState>) -> Result<PomodoroStatus, String> {
    let feature = state
        .get_feature("pomodoro")
        .ok_or_else(|| "pomodoro feature not found".to_string())?;
    let feature = feature
        .as_any()
        .downcast_ref::<crate::features::pomodoro::PomodoroFeature>()
        .ok_or_else(|| "invalid pomodoro feature".to_string())?;
    let manager = feature.manager().ok_or_else(|| "pomodoro manager not initialized".to_string())?;
    Ok(manager.resume().await)
}

#[tauri::command]
pub async fn pomodoro_skip(state: State<'_, AppState>) -> Result<PomodoroStatus, String> {
    let cfg = service::get_config(state.db()).await.map_err(|e| e.to_string())?;
    let feature = state
        .get_feature("pomodoro")
        .ok_or_else(|| "pomodoro feature not found".to_string())?;
    let feature = feature
        .as_any()
        .downcast_ref::<crate::features::pomodoro::PomodoroFeature>()
        .ok_or_else(|| "invalid pomodoro feature".to_string())?;
    let manager = feature.manager().ok_or_else(|| "pomodoro manager not initialized".to_string())?;
    Ok(manager.skip(cfg).await)
}

#[tauri::command]
pub async fn pomodoro_stop(state: State<'_, AppState>) -> Result<PomodoroStatus, String> {
    let feature = state
        .get_feature("pomodoro")
        .ok_or_else(|| "pomodoro feature not found".to_string())?;
    let feature = feature
        .as_any()
        .downcast_ref::<crate::features::pomodoro::PomodoroFeature>()
        .ok_or_else(|| "invalid pomodoro feature".to_string())?;
    let manager = feature.manager().ok_or_else(|| "pomodoro manager not initialized".to_string())?;
    Ok(manager.stop().await)
}

#[tauri::command]
pub async fn pomodoro_status(state: State<'_, AppState>) -> Result<PomodoroStatus, String> {
    let feature = state
        .get_feature("pomodoro")
        .ok_or_else(|| "pomodoro feature not found".to_string())?;
    let feature = feature
        .as_any()
        .downcast_ref::<crate::features::pomodoro::PomodoroFeature>()
        .ok_or_else(|| "invalid pomodoro feature".to_string())?;
    let manager = feature.manager().ok_or_else(|| "pomodoro manager not initialized".to_string())?;
    Ok(manager.status().await)
}

#[tauri::command]
pub async fn pomodoro_get_config(state: State<'_, AppState>) -> Result<PomodoroConfig, String> {
    service::get_config(state.db()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pomodoro_set_config(
    state: State<'_, AppState>,
    config: PomodoroConfig,
) -> Result<(), String> {
    service::set_config(state.db(), config).await.map_err(|e| e.to_string())
}

// ==================== Record Commands (保留兼容性) ====================

#[tauri::command]
pub async fn pomodoro_list_sessions(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<record_entity::Model>, String> {
    let lim = limit.unwrap_or(50) as u64;
    service::list_recent_records(state.db(), lim).await.map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
pub struct StatsRangePayload {
    pub from: String,
    pub to: String,
}

#[tauri::command]
pub async fn pomodoro_stats(
    state: State<'_, AppState>,
    payload: StatsRangePayload,
) -> Result<service::PomodoroStats, String> {
    let from = chrono::DateTime::parse_from_rfc3339(&payload.from)
        .map_err(|e| e.to_string())?
        .with_timezone(&chrono::Utc);
    let to = chrono::DateTime::parse_from_rfc3339(&payload.to)
        .map_err(|e| e.to_string())?
        .with_timezone(&chrono::Utc);
    service::get_stats_range(state.db(), from, to).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pomodoro_delete_session(
    state: State<'_, AppState>,
    session_id: i32,
) -> Result<(), String> {
    service::delete_record(state.db(), session_id).await.map_err(|e| e.to_string())
}

// ==================== New Session Management Commands ====================

/// 创建新 Session
#[tauri::command]
pub async fn pomodoro_create_session(
    state: State<'_, AppState>,
    note: Option<String>,
) -> Result<session_entity::Model, String> {
    service::create_session(state.db(), note).await.map_err(|e| e.to_string())
}

/// 获取指定 Session
#[tauri::command]
pub async fn pomodoro_get_session(
    state: State<'_, AppState>,
    session_id: i32,
) -> Result<Option<session_entity::Model>, String> {
    service::get_session_by_id(state.db(), session_id).await.map_err(|e| e.to_string())
}

/// 获取所有 Sessions
#[tauri::command]
pub async fn pomodoro_list_all_sessions(
    state: State<'_, AppState>,
    include_archived: Option<bool>,
) -> Result<Vec<session_entity::Model>, String> {
    let include = include_archived.unwrap_or(false);
    service::list_sessions(state.db(), include).await.map_err(|e| e.to_string())
}

/// 更新 Session 备注
#[tauri::command]
pub async fn pomodoro_update_session_note(
    state: State<'_, AppState>,
    session_id: i32,
    note: Option<String>,
) -> Result<session_entity::Model, String> {
    service::update_session_note(state.db(), session_id, note).await.map_err(|e| e.to_string())
}

/// 归档 Session
#[tauri::command]
pub async fn pomodoro_archive_session(
    state: State<'_, AppState>,
    session_id: i32,
) -> Result<session_entity::Model, String> {
    service::archive_session(state.db(), session_id).await.map_err(|e| e.to_string())
}

/// 删除 Session（级联删除）
#[tauri::command]
pub async fn pomodoro_delete_session_cascade(
    state: State<'_, AppState>,
    session_id: i32,
) -> Result<(), String> {
    service::delete_session_cascade(state.db(), session_id).await.map_err(|e| e.to_string())
}

/// 获取活动 Session（不自动创建）
#[tauri::command]
pub async fn pomodoro_get_active_session(
    state: State<'_, AppState>,
) -> Result<Option<session_entity::Model>, String> {
    service::get_active_session(state.db()).await.map_err(|e| e.to_string())
}

/// 获取或创建活动 Session
/// 如果提供了 pending_note，在创建新 session 时将使用该备注
#[tauri::command]
pub async fn pomodoro_get_or_create_active_session(
    state: State<'_, AppState>,
    pending_note: Option<String>,
) -> Result<session_entity::Model, String> {
    service::get_or_create_active_session(state.db(), pending_note).await.map_err(|e| e.to_string())
}

/// 获取 Session 的所有 Records
#[tauri::command]
pub async fn pomodoro_list_session_records(
    state: State<'_, AppState>,
    session_id: i32,
) -> Result<Vec<record_entity::Model>, String> {
    service::list_session_records(state.db(), session_id).await.map_err(|e| e.to_string())
}

/// 生成 Session 动态标题
#[tauri::command]
pub async fn pomodoro_generate_session_title(
    state: State<'_, AppState>,
    session_id: i32,
) -> Result<String, String> {
    service::generate_session_title(state.db(), session_id).await.map_err(|e| e.to_string())
}

/// 保存上次调整的时间配置
#[derive(serde::Deserialize)]
pub struct SaveAdjustedTimesPayload {
    pub focus_minutes: Option<u32>,
    pub rest_minutes: Option<u32>,
}

#[tauri::command]
pub async fn pomodoro_save_adjusted_times(
    state: State<'_, AppState>,
    payload: SaveAdjustedTimesPayload,
) -> Result<(), String> {
    service::save_last_adjusted_times(state.db(), payload.focus_minutes, payload.rest_minutes)
        .await
        .map_err(|e| e.to_string())
}

/// 获取上次调整的时间配置
#[derive(serde::Serialize)]
pub struct GetAdjustedTimesResponse {
    pub focus_minutes: Option<u32>,
    pub rest_minutes: Option<u32>,
}

#[tauri::command]
pub async fn pomodoro_get_adjusted_times(
    state: State<'_, AppState>,
) -> Result<GetAdjustedTimesResponse, String> {
    let (focus, rest) = service::get_last_adjusted_times(state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(GetAdjustedTimesResponse {
        focus_minutes: focus,
        rest_minutes: rest,
    })
}
