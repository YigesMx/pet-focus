use tauri::{AppHandle, Emitter, Manager};

use crate::features::settings::core::service::SettingService;
use crate::infrastructure::tray::TrayMenuItem;
use crate::AppState;

const WEBSERVER_STATUS_CHANGED_EVENT: &str = "webserver-status-changed";

/// 启动 WebSocket API 菜单项
pub fn start_webserver_item() -> TrayMenuItem {
    TrayMenuItem::new(
        "start_server",
        "启动 WebSocket API",
        |app: &AppHandle| {
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    match state
                        .webserver_manager()
                        .start(state.db().clone(), app_handle.clone(), None)
                        .await
                    {
                        Ok(_) => {
                            println!("Web server started successfully");
                            // 保存设置
                            let _ =
                                SettingService::set_bool(state.db(), "webserver.auto_start", true)
                                    .await;
                            // 通知前端状态变化
                            let _ = app_handle.emit(WEBSERVER_STATUS_CHANGED_EVENT, true);
                            // 更新托盘菜单
                            let _ = state.tray_manager().update_tray_menu(&app_handle);
                        }
                        Err(e) => {
                            eprintln!("Failed to start web server: {}", e);
                        }
                    }
                }
            });
        },
        // 只有在 WebServer 未运行时才显示
        |app: &AppHandle| {
            if let Some(state) = app.try_state::<AppState>() {
                state.webserver_manager().get_connection_manager().is_none()
            } else {
                false
            }
        },
    )
}

/// 停止 WebSocket API 菜单项
pub fn stop_webserver_item() -> TrayMenuItem {
    TrayMenuItem::new(
        "stop_server",
        "停止 WebSocket API",
        |app: &AppHandle| {
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    match state.webserver_manager().stop().await {
                        Ok(_) => {
                            println!("Web server stopped successfully");
                            // 保存设置
                            let _ =
                                SettingService::set_bool(state.db(), "webserver.auto_start", false)
                                    .await;
                            // 通知前端状态变化
                            let _ = app_handle.emit(WEBSERVER_STATUS_CHANGED_EVENT, false);
                            // 更新托盘菜单
                            let _ = state.tray_manager().update_tray_menu(&app_handle);
                        }
                        Err(e) => {
                            eprintln!("Failed to stop web server: {}", e);
                        }
                    }
                }
            });
        },
        // 只有在 WebServer 正在运行时才显示
        |app: &AppHandle| {
            if let Some(state) = app.try_state::<AppState>() {
                state.webserver_manager().get_connection_manager().is_some()
            } else {
                false
            }
        },
    )
}
