use sea_orm::DatabaseConnection;
use serde_json::json;
use tauri::{AppHandle, Emitter, Wry};

const TODO_CHANGE_EVENT: &str = "todo-data-updated";

#[derive(Clone)]
pub(super) struct ApiContext {
    db: DatabaseConnection,
    app_handle: AppHandle<Wry>,
}

impl ApiContext {
    pub(super) fn new(db: DatabaseConnection, app_handle: AppHandle<Wry>) -> Self {
        Self { db, app_handle }
    }

    pub(super) fn db(&self) -> &DatabaseConnection {
        &self.db
    }

    pub(super) fn notify_change(&self, action: &'static str, todo_id: Option<i32>) {
        if let Err(err) = self
            .app_handle
            .emit(TODO_CHANGE_EVENT, json!({ "action": action, "todoId": todo_id }))
        {
            eprintln!("failed to emit todo change event: {err}");
        }
    }
}
