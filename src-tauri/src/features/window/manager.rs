// 窗口管理功能
#![cfg(not(any(target_os = "android", target_os = "ios")))]

use tauri::{AppHandle, CloseRequestApi, Emitter, Manager, Window, Wry};

use crate::core::AppState;
use crate::features::settings::core::service::SettingService;

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

/// 获取关闭行为设置（同步版本，用于事件回调）
/// 返回 "ask" 表示需要询问用户，"minimize" 表示最小化，"quit" 表示退出
fn get_close_behavior_sync(app: &AppHandle<Wry>) -> String {
    if let Some(state) = app.try_state::<AppState>() {
        tauri::async_runtime::block_on(async {
            SettingService::get_or_default(state.db(), "window.close_behavior", "ask")
                .await
                .unwrap_or_else(|_| "ask".to_string())
        })
    } else {
        "ask".to_string()
    }
}

/// 处理窗口关闭请求
///
/// 根据用户设置决定：
/// - "ask": 弹出对话框让用户选择（默认）
/// - "minimize": 最小化到托盘
/// - "quit": 完全退出应用（包括关闭 Pet/Lynx 进程）
pub fn handle_window_close_request(window: &Window<Wry>, api: &CloseRequestApi) {
    let app = window.app_handle();
    let close_behavior = get_close_behavior_sync(&app);

    // 始终阻止默认关闭行为
    api.prevent_close();

    match close_behavior.as_str() {
        "quit" => {
            // 直接退出应用
            quit_app_internal(&app);
        }
        "minimize" => {
            // 直接最小化到托盘
            let _ = window.hide();

            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
        }
        _ => {
            // "ask" 或其他情况：发送事件到前端，让用户选择
            let _ = app.emit("window-close-requested", ());
        }
    }
}

/// 内部退出应用函数
fn quit_app_internal(app: &AppHandle<Wry>) {
    // 停止 Pet/Lynx 进程（仅 Windows）
    #[cfg(target_os = "windows")]
    {
        if let Some(state) = app.try_state::<AppState>() {
            use crate::features::pet::PetFeature;
            if let Some(feature) = state.get_feature("pet") {
                if let Some(pet_feature) = feature.as_any().downcast_ref::<PetFeature>() {
                    if let Some(manager) = pet_feature.manager() {
                        let _ = manager.stop();
                        println!("Pet process stopped before quitting");
                    }
                }
            }
        }
    }

    // 退出应用
    app.exit(0);
}

/// 退出应用（公开 API，供命令调用）
pub fn quit_app(app: &AppHandle<Wry>) {
    quit_app_internal(app);
}
