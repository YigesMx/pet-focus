// 库模块声明 - 所有业务逻辑模块都在 lib 子目录下
mod lib {
    pub mod commands;
    pub mod db;
    pub mod entities;
    pub mod models;
    pub mod services;
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    pub mod tray;
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    pub mod webserver;
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    pub mod window;
}

// 重新导出公共 API
pub use lib::entities;

use sea_orm::DatabaseConnection;
use tauri::{AppHandle, Emitter, Manager, Wry};

use lib::services::caldav::{CalDavSyncManager, SyncReason};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use lib::webserver::WebServerManager;

pub struct AppState {
    app_handle: AppHandle<Wry>,
    db: DatabaseConnection,
    caldav: CalDavSyncManager,
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    web_server: WebServerManager,
}

impl AppState {
    pub fn new(app_handle: AppHandle<Wry>, db: DatabaseConnection) -> Self {
        let caldav = CalDavSyncManager::new(db.clone(), app_handle.clone());
        Self {
            app_handle,
            db,
            caldav,
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            web_server: WebServerManager::new(),
        }
    }

    pub fn db(&self) -> &DatabaseConnection {
        &self.db
    }

    pub fn app_handle(&self) -> AppHandle<Wry> {
        self.app_handle.clone()
    }

    pub fn caldav(&self) -> &CalDavSyncManager {
        &self.caldav
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    pub fn web_server(&self) -> &WebServerManager {
        &self.web_server
    }

    /// 统一的 todo 变更通知方法
    /// 当任何 todo 数据发生变化时调用此方法，会：
    /// 1. 发送事件给前端
    /// 2. 触发调度器重新调度
    pub async fn notify_todo_change(&self, action: &'static str, todo_id: Option<i32>) {
        // 通知前端（标记为来自本地命令）
        if let Err(err) = self.app_handle.emit(
            "todo-data-updated",
            serde_json::json!({
                "action": action,
                "todoId": todo_id,
                "source": "local"
            }),
        ) {
            eprintln!("Failed to emit todo change event: {err}");
        }

        // 触发调度器重新调度
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        self.web_server.reschedule_notifications().await;

        self.caldav.trigger(SyncReason::DataChanged);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();

            match tauri::async_runtime::block_on(lib::db::init_db(&handle)) {
                Ok(db) => {
                    let state = AppState::new(handle.clone(), db);

                    // 根据设置决定是否自动启动 WebServer
                    #[cfg(not(any(target_os = "android", target_os = "ios")))]
                    {
                        use lib::services::setting_service::SettingService;

                        let db_clone = state.db().clone();
                        let app_handle = state.app_handle();
                        let web_server = state.web_server().clone();

                        tauri::async_runtime::spawn(async move {
                            match SettingService::get_bool(&db_clone, "webserver.auto_start", false)
                                .await
                            {
                                Ok(true) => {
                                    println!("Auto-starting WebServer based on settings...");
                                    if let Err(e) = web_server
                                        .start(db_clone.clone(), app_handle.clone(), None)
                                        .await
                                    {
                                        eprintln!("Failed to auto-start WebServer: {}", e);
                                    } else {
                                        println!("WebServer auto-started successfully");
                                        // 更新托盘菜单
                                        let _ =
                                            lib::tray::update_tray_menu_from_app(&app_handle, true);
                                    }
                                }
                                Ok(false) => {
                                    println!("WebServer auto-start is disabled");
                                }
                                Err(e) => {
                                    eprintln!("Failed to read auto-start setting: {}", e);
                                }
                            }
                        });
                    }

                    app.manage(state);

                    // 创建系统托盘（仅桌面平台）
                    #[cfg(not(any(target_os = "android", target_os = "ios")))]
                    if let Err(e) = lib::tray::create_tray(&handle) {
                        eprintln!("Failed to create system tray: {}", e);
                    }

                    Ok(())
                }
                Err(err) => Err(err.into()),
            }
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                // 桌面平台：隐藏窗口而不是关闭
                #[cfg(not(any(target_os = "android", target_os = "ios")))]
                {
                    let _ = lib::window::hide_main_window(&window.app_handle());
                    api.prevent_close();
                }
                // 移动平台：允许正常关闭
                #[cfg(any(target_os = "android", target_os = "ios"))]
                {
                    // 不阻止关闭，让应用正常关闭
                    let _ = (window, api);
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            lib::commands::list_todos,
            lib::commands::create_todo,
            lib::commands::update_todo,
            lib::commands::delete_todo,
            lib::commands::update_todo_details,
            lib::commands::get_caldav_status,
            lib::commands::save_caldav_config,
            lib::commands::clear_caldav_config,
            lib::commands::sync_caldav_now,
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            lib::commands::start_web_server,
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            lib::commands::stop_web_server,
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            lib::commands::web_server_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
