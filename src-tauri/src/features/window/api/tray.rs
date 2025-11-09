use tauri::AppHandle;

use crate::infrastructure::tray::TrayMenuItem;
use crate::features::window::manager;

/// 窗口显示/隐藏切换菜单项
pub fn toggle_window_item() -> TrayMenuItem {
    TrayMenuItem::always_visible(
        "toggle",
        "显示/隐藏窗口",
        |app: &AppHandle| {
            let _ = manager::toggle_main_window(app);
        },
    )
}
