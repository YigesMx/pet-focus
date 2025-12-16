// Window Feature Commands

use tauri::{AppHandle, Wry};

use super::super::manager;

/// 退出应用（包括关闭 Pet/Lynx 进程）
#[tauri::command]
pub async fn quit_app(app: AppHandle<Wry>) -> Result<(), String> {
    manager::quit_app(&app);
    Ok(())
}

/// 隐藏窗口到托盘
#[tauri::command]
pub async fn hide_window(app: AppHandle<Wry>) -> Result<(), String> {
    manager::hide_main_window(&app)
}
