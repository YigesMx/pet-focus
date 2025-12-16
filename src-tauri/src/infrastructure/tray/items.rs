use tauri::{AppHandle, Manager};

use crate::infrastructure::tray::TrayMenuItem;
use crate::AppState;

/// 退出应用菜单项
pub fn quit_app_item() -> TrayMenuItem {
    TrayMenuItem::always_visible("quit", "退出", |app: &AppHandle| {
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            if let Some(state) = app_handle.try_state::<AppState>() {
                // 先停止 web server
                let _ = state.webserver_manager().stop().await;
            }

            // 停止 Pet/Lynx 进程（仅 Windows）
            #[cfg(target_os = "windows")]
            {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    use crate::features::pet::PetFeature;
                    if let Some(feature) = state.get_feature("pet") {
                        if let Some(pet_feature) = feature.as_any().downcast_ref::<PetFeature>() {
                            if let Some(manager) = pet_feature.manager() {
                                let _ = manager.stop();
                                println!("Pet process stopped before quitting (from tray)");
                            }
                        }
                    }
                }
            }

            // 退出应用
            app_handle.exit(0);
        });
    })
}
