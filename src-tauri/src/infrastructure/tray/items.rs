use tauri::{AppHandle, Manager};

use crate::infrastructure::tray::TrayMenuItem;
use crate::AppState;

/// 退出应用菜单项
pub fn quit_app_item() -> TrayMenuItem {
    TrayMenuItem::always_visible("quit", "退出", |app: &AppHandle| {
        // 先停止 web server
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            if let Some(state) = app_handle.try_state::<AppState>() {
                let _ = state.webserver_manager().stop().await;
            }
            // 退出应用
            app_handle.exit(0);
        });
    })
}
