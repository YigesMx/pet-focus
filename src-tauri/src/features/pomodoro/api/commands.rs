use tauri::State;

use crate::core::AppState;
use crate::features::pomodoro::core::{models::PomodoroStatus, service, PomodoroConfig};

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

#[tauri::command]
pub async fn pomodoro_list_sessions(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<crate::features::pomodoro::data::entity::Model>, String> {
    let lim = limit.unwrap_or(50) as u64;
    service::list_recent_sessions(state.db(), lim).await.map_err(|e| e.to_string())
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
