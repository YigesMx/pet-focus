use sea_orm::DatabaseConnection;
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Wry};
use tokio::sync::Mutex;

use super::{connection::ConnectionManager, scheduler::DueNotificationScheduler};

const TODO_CHANGE_EVENT: &str = "todo-data-updated";

#[derive(Clone)]
pub(super) struct ApiContext {
    db: DatabaseConnection,
    app_handle: AppHandle<Wry>,
    connection_manager: ConnectionManager,
    scheduler: Arc<Mutex<Option<DueNotificationScheduler>>>,
}

impl ApiContext {
    pub(super) fn new(
        db: DatabaseConnection,
        app_handle: AppHandle<Wry>,
        connection_manager: ConnectionManager,
        scheduler: Arc<Mutex<Option<DueNotificationScheduler>>>,
    ) -> Self {
        Self {
            db,
            app_handle,
            connection_manager,
            scheduler,
        }
    }

    pub(super) fn db(&self) -> &DatabaseConnection {
        &self.db
    }

    pub(super) fn app_handle(&self) -> &AppHandle<Wry> {
        &self.app_handle
    }

    pub(super) fn connection_manager(&self) -> &ConnectionManager {
        &self.connection_manager
    }

    /// 统一的 todo 变更通知方法
    /// 会同时：1. 发送事件给前端  2. 触发调度器重新调度
    pub(super) async fn notify_change(&self, action: &'static str, todo_id: Option<i32>) {
        // 通知前端（标记为来自 webserver）
        if let Err(err) = self
            .app_handle
            .emit(TODO_CHANGE_EVENT, json!({ 
                "action": action, 
                "todoId": todo_id,
                "source": "webserver"
            }))
        {
            eprintln!("failed to emit todo change event: {err}");
        }

        // 触发调度器重新调度
        self.reschedule_notifications().await;
    }

    /// 触发调度器重新调度（当 todo 数据变更时调用）
    async fn reschedule_notifications(&self) {
        let guard = self.scheduler.lock().await;
        if let Some(scheduler) = guard.as_ref() {
            scheduler.reschedule().await;
        }
    }
}
