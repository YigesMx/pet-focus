use tauri::{Emitter, State};

use crate::core::AppState;
use crate::features::settings::core::service::SettingService;
use crate::infrastructure::webserver::core::WebServerStatus;

const WEBSERVER_STATUS_CHANGED_EVENT: &str = "webserver-status-changed";

/// 启动 WebServer
#[tauri::command]
pub async fn start_web_server(state: State<'_, AppState>) -> Result<WebServerStatus, String> {
    let result = state
        .webserver_manager()
        .start(state.db().clone(), state.app_handle(), None)
        .await;

    match &result {
        Ok(status) => {
            // 保存设置
            let _ = SettingService::set_bool(state.db(), "webserver.auto_start", true).await;

            // 通知前端状态变化（直接使用 Tauri Event）
            let _ = state
                .app_handle()
                .emit(WEBSERVER_STATUS_CHANGED_EVENT, true);

            // 更新托盘菜单（重新评估 is_visible 条件）
            let _ = state.tray_manager().update_tray_menu(&state.app_handle());

            // Toast 通知
            if let Some(port) = status.port {
                super::notifications::notify_server_started(state.notification(), port);
            }
        }
        Err(e) => {
            // Toast 通知
            super::notifications::notify_server_start_failed(state.notification(), &e.to_string());
        }
    }

    result.map_err(|e| e.to_string())
}

/// 停止 WebServer
#[tauri::command]
pub async fn stop_web_server(state: State<'_, AppState>) -> Result<WebServerStatus, String> {
    let result = state.webserver_manager().stop().await;

    match &result {
        Ok(_) => {
            // 保存设置
            let _ = SettingService::set_bool(state.db(), "webserver.auto_start", false).await;

            // 通知前端状态变化（直接使用 Tauri Event）
            let _ = state
                .app_handle()
                .emit(WEBSERVER_STATUS_CHANGED_EVENT, false);

            // 更新托盘菜单（重新评估 is_visible 条件）
            let _ = state.tray_manager().update_tray_menu(&state.app_handle());

            // Toast 通知
            super::notifications::notify_server_stopped(state.notification());
        }
        Err(e) => {
            // Toast 通知
            super::notifications::notify_server_stop_failed(state.notification(), &e.to_string());
        }
    }

    result.map_err(|e| e.to_string())
}

/// 获取 WebServer 状态
#[tauri::command]
pub async fn web_server_status(state: State<'_, AppState>) -> Result<WebServerStatus, String> {
    Ok(state.webserver_manager().status().await)
}
