// 新架构模块
mod core;
mod infrastructure;
mod features;

// 重新导出核心类型
pub use core::AppState;

// 重新导出旧的 entities（向后兼容）
pub mod entities {
    pub use crate::features::todo::data::entity as todo;
    pub use crate::features::settings::data::entity as setting;

    pub mod prelude {
        pub use super::todo::Entity as Todo;
        pub use super::setting::Entity as Setting;
    }
}

// 重新导出 models（API 响应模型）
pub mod models {
    pub mod todo {
        pub use crate::features::todo::core::models::*;
    }
    pub mod setting {
        pub use crate::features::settings::core::models::*;
    }
}

use std::sync::Arc;
use tauri::Manager;
use core::Feature;
use infrastructure::database::{init_db, DatabaseRegistry};
use features::{todo::TodoFeature, settings::SettingsFeature, window::WindowFeature};

/// 初始化所有 Features
fn init_features() -> Vec<Arc<dyn Feature>> {
    vec![
        TodoFeature::new(),
        SettingsFeature::new(),
        Arc::new(WindowFeature::new()),
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();

            // 初始化数据库
            let db = tauri::async_runtime::block_on(init_db(&handle))
                .map_err(|e| format!("Failed to init database: {}", e))?;

            // 初始化所有 Features
            let features = init_features();

            // 创建数据库注册表并执行所有 Migrations
            let mut db_registry = DatabaseRegistry::new();
            for feature in &features {
                feature.register_database(&mut db_registry);
            }

            tauri::async_runtime::block_on(db_registry.run_migrations(&db))
                .map_err(|e| format!("Failed to run migrations: {}", e))?;

            // 创建 AppState
            let state = AppState::new(handle.clone(), db, features.clone());

            // 注册 WebSocket Handlers（仅桌面平台）
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let mut registry = tauri::async_runtime::block_on(state.webserver_manager().registry_mut());
                for feature in &features {
                    feature.register_ws_handlers(&mut registry);
                }
            }

            // 初始化所有 Features
            for feature in &features {
                tauri::async_runtime::block_on(feature.initialize(&state))
                    .map_err(|e| format!("Failed to initialize feature '{}': {}", feature.name(), e))?;
            }

            app.manage(state);

            // 创建系统托盘（仅桌面平台）
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                if let Some(app_state) = app.try_state::<AppState>() {
                    app_state
                        .tray_manager()
                        .create_tray(&handle)
                        .map_err(|e| format!("Failed to create tray: {}", e))?;
                    
                    // 自动启动 WebServer（如果配置了）
                    let app_handle = handle.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Some(state) = app_handle.try_state::<AppState>() {
                            use crate::features::settings::core::service::SettingService;
                            
                            match SettingService::get_bool(state.db(), "webserver.auto_start", false).await {
                                Ok(true) => {
                                    println!("Auto-starting web server...");
                                    if let Err(e) = state.webserver_manager()
                                        .start(state.db().clone(), app_handle.clone(), None)
                                        .await 
                                    {
                                        eprintln!("Failed to auto-start web server: {}", e);
                                    }
                                }
                                Ok(false) => {}
                                Err(e) => {
                                    eprintln!("Failed to read auto-start setting: {}", e);
                                }
                            }
                        }
                    });
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                #[cfg(not(any(target_os = "android", target_os = "ios")))]
                {
                    use crate::features::window::manager;
                    // 阻止窗口关闭，改为隐藏
                    api.prevent_close();
                    // 隐藏窗口并在 macOS 上隐藏 Dock 图标
                    let _ = manager::hide_main_window(&window.app_handle());
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            // Todo Feature Commands
            features::todo::api::commands::list_todos,
            features::todo::api::commands::create_todo,
            features::todo::api::commands::update_todo,
            features::todo::api::commands::delete_todo,
            features::todo::api::commands::update_todo_details,
            
            // CalDAV Commands
            features::todo::sync::caldav_commands::get_caldav_status,
            features::todo::sync::caldav_commands::save_caldav_config,
            features::todo::sync::caldav_commands::clear_caldav_config,
            features::todo::sync::caldav_commands::sync_caldav_now,
            
            // Settings Feature Commands
            features::settings::api::commands::get_theme_preference,
            features::settings::api::commands::set_theme_preference,
            
            // WebServer Commands (Desktop only)
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            infrastructure::webserver::api::commands::start_web_server,
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            infrastructure::webserver::api::commands::stop_web_server,
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            infrastructure::webserver::api::commands::web_server_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
