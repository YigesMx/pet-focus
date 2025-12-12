use tauri::State;

use crate::core::AppState;
use crate::features::settings::core::service::SettingService;

use super::PetFeature;

#[tauri::command]
pub async fn pet_start(state: State<'_, AppState>) -> Result<(), String> {
    let feature = state.get_feature("pet").ok_or("Pet feature not found")?;
    let feature = feature
        .as_any()
        .downcast_ref::<PetFeature>()
        .ok_or("Invalid feature type")?;

    if let Some(manager) = feature.manager() {
        manager.start()
    } else {
        Err("Pet manager not initialized".to_string())
    }
}

#[tauri::command]
pub async fn pet_stop(state: State<'_, AppState>) -> Result<(), String> {
    let feature = state.get_feature("pet").ok_or("Pet feature not found")?;
    let feature = feature
        .as_any()
        .downcast_ref::<PetFeature>()
        .ok_or("Invalid feature type")?;

    if let Some(manager) = feature.manager() {
        manager.stop()
    } else {
        Err("Pet manager not initialized".to_string())
    }
}

#[tauri::command]
pub async fn pet_status(state: State<'_, AppState>) -> Result<bool, String> {
    let feature = state.get_feature("pet").ok_or("Pet feature not found")?;
    let feature = feature
        .as_any()
        .downcast_ref::<PetFeature>()
        .ok_or("Invalid feature type")?;

    if let Some(manager) = feature.manager() {
        Ok(manager.is_running())
    } else {
        Err("Pet manager not initialized".to_string())
    }
}

#[tauri::command]
pub async fn get_pet_auto_start(state: State<'_, AppState>) -> Result<bool, String> {
    SettingService::get_or_default(state.db(), "pet.auto_start", "true")
        .await
        .map(|v| v == "true")
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_pet_auto_start(state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    SettingService::set(state.db(), "pet.auto_start", &enabled.to_string())
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}
