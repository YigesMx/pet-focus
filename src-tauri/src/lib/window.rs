// 窗口管理功能
#![cfg(not(any(target_os = "android", target_os = "ios")))]

use tauri::{AppHandle, Manager, Wry};

/// 显示主窗口并设置焦点
/// macOS: 同时显示 Dock 图标
pub fn show_main_window(app: &AppHandle<Wry>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;

        // macOS: 窗口显示时显示 Dock 图标
        #[cfg(target_os = "macos")]
        {
            app.set_activation_policy(tauri::ActivationPolicy::Regular)
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

/// 隐藏主窗口
/// macOS: 同时隐藏 Dock 图标
pub fn hide_main_window(app: &AppHandle<Wry>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;

        // macOS: 窗口隐藏时隐藏 Dock 图标
        #[cfg(target_os = "macos")]
        {
            app.set_activation_policy(tauri::ActivationPolicy::Accessory)
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

/// 切换主窗口显示/隐藏状态
pub fn toggle_main_window(app: &AppHandle<Wry>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            hide_main_window(app)
        } else {
            show_main_window(app)
        }
    } else {
        Err("Main window not found".to_string())
    }
}
