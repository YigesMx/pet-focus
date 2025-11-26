// 新架构模块
mod core;
mod features;
mod infrastructure;

// 重新导出核心类型
pub use core::AppState;

use core::Feature;
use features::{
    pomodoro::PomodoroFeature, settings::SettingsFeature, todo::TodoFeature, window::WindowFeature,
};
#[cfg(target_os = "windows")]
use features::pet::PetFeature;
use infrastructure::database::{init_db, DatabaseRegistry};
use std::sync::Arc;
use tauri::Manager;

/// 初始化所有 Features
fn init_features() -> Vec<Arc<dyn Feature>> {
    #[allow(unused_mut)]
    let mut features: Vec<Arc<dyn Feature>> = vec![
        TodoFeature::new(),
        SettingsFeature::new(),
        PomodoroFeature::new(),
        Arc::new(WindowFeature::new()),
    ];

    #[cfg(target_os = "windows")]
    features.push(PetFeature::new());

    features
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
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
            let mut state = AppState::new(handle.clone(), db, features.clone());

            // 注册 WebSocket Handlers（仅桌面平台）
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let mut registry =
                    tauri::async_runtime::block_on(state.webserver_manager().registry_mut());
                for feature in &features {
                    feature.register_ws_handlers(&mut registry);
                }
            }

            // 构建并设置 Tray Registry（仅桌面平台）
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let tray_registry = core::registry::tray::build_tray_registry();
                state.set_tray_registry(tray_registry);
            }

            // 初始化所有 Features
            for feature in &features {
                tauri::async_runtime::block_on(feature.initialize(&state)).map_err(|e| {
                    format!("Failed to initialize feature '{}': {}", feature.name(), e)
                })?;
            }

            // 托管状态
            app.manage(state);

            // 后初始化（执行需要访问已托管状态的逻辑）
            if let Some(app_state) = app.try_state::<AppState>() {
                tauri::async_runtime::block_on(app_state.post_initialize(&handle))
                    .map_err(|e| format!("Post-initialization failed: {}", e))?;
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                #[cfg(not(any(target_os = "android", target_os = "ios")))]
                {
                    features::window::manager::handle_window_close_request(window, api);
                }
            }
            _ => {}
        })
        .invoke_handler(core::registry::commands::get_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
