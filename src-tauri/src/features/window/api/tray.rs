#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri::AppHandle;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::features::window::manager;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::infrastructure::tray::TrayMenuItem;

/// 窗口显示/隐藏切换菜单项
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn toggle_window_item() -> TrayMenuItem {
    TrayMenuItem::always_visible("toggle", "显示/隐藏窗口", |app: &AppHandle| {
        let _ = manager::toggle_main_window(app);
    })
}
