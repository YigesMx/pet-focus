mod commands;
mod db;
pub mod entities;
mod models;
mod services;
mod tray;
mod webserver;

use sea_orm::DatabaseConnection;
use tauri::{AppHandle, Manager, Wry};

use webserver::WebServerManager;

pub struct AppState {
    app_handle: AppHandle<Wry>,
    db: DatabaseConnection,
    web_server: WebServerManager,
}

impl AppState {
    pub fn new(app_handle: AppHandle<Wry>, db: DatabaseConnection) -> Self {
        Self {
            app_handle,
            db,
            web_server: WebServerManager::new(),
        }
    }

    pub fn db(&self) -> &DatabaseConnection {
        &self.db
    }

    pub fn app_handle(&self) -> AppHandle<Wry> {
        self.app_handle.clone()
    }

    pub fn web_server(&self) -> &WebServerManager {
        &self.web_server
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();

            match tauri::async_runtime::block_on(db::init_db(&handle)) {
                Ok(db) => {
                    app.manage(AppState::new(handle.clone(), db));
                    
                    // 创建系统托盘
                    if let Err(e) = tray::create_tray(&handle) {
                        eprintln!("Failed to create system tray: {}", e);
                    }
                    
                    Ok(())
                }
                Err(err) => Err(err.into()),
            }
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_todos,
            commands::create_todo,
            commands::update_todo,
            commands::delete_todo,
            commands::start_web_server,
            commands::stop_web_server,
            commands::web_server_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
