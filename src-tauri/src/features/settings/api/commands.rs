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
