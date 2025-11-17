use sea_orm::DatabaseConnection;
use tauri::{AppHandle, Wry};

use super::connection::ConnectionManager;

/// WebSocket API 上下文
///
/// 提供给 WS Handler 的执行上下文
#[derive(Clone)]
pub struct ApiContext {
    db: DatabaseConnection,
    app_handle: AppHandle<Wry>,
    connection_manager: ConnectionManager,
}

impl ApiContext {
    pub fn new(
        db: DatabaseConnection,
        app_handle: AppHandle<Wry>,
        connection_manager: ConnectionManager,
    ) -> Self {
        Self {
            db,
            app_handle,
            connection_manager,
        }
    }

    pub fn db(&self) -> &DatabaseConnection {
        &self.db
    }

    pub fn app_handle(&self) -> &AppHandle<Wry> {
        &self.app_handle
    }

    pub fn connection_manager(&self) -> &ConnectionManager {
        &self.connection_manager
    }
}
