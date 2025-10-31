mod commands;
mod db;
pub mod entities;
mod models;
mod services;

use sea_orm::DatabaseConnection;
use tauri::Manager;

pub struct AppState {
    db: DatabaseConnection,
}

impl AppState {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn db(&self) -> &DatabaseConnection {
        &self.db
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
                    app.manage(AppState::new(db));
                    Ok(())
                }
                Err(err) => Err(err.into()),
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_todos,
            commands::create_todo,
            commands::update_todo,
            commands::delete_todo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
