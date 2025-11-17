use std::sync::Arc;
use tokio::sync::OnceCell;

use anyhow::Result;
use async_trait::async_trait;
use sea_orm_migration::MigrationTrait;

use crate::core::{AppState, Feature};
use crate::infrastructure::database::DatabaseRegistry;

use super::core::scheduler::DueNotificationScheduler;
use super::data::{add_subtask_migration, migration};

/// Todo Feature
///
/// 负责 Todo 功能的所有逻辑，包括：
/// - 数据库 Entity 和 Migration
/// - CRUD Commands
/// - CalDAV 同步
/// - 到期提醒调度
pub struct TodoFeature {
    scheduler: OnceCell<Arc<DueNotificationScheduler>>,
}

impl TodoFeature {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            scheduler: OnceCell::new(),
        })
    }

    /// 获取调度器（仅在初始化后可用）
    pub fn scheduler(&self) -> Option<&Arc<DueNotificationScheduler>> {
        self.scheduler.get()
    }
}

#[async_trait]
impl Feature for TodoFeature {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn name(&self) -> &'static str {
        "todo"
    }

    fn register_database(&self, registry: &mut DatabaseRegistry) {
        // 注册 Todo 数据表迁移
        registry.register_migration("todo_migration", |manager| {
            let migration = migration::TodoMigration;
            Box::pin(async move { migration.up(manager).await })
        });

        // 注册子任务支持迁移
        registry.register_migration("add_subtask_migration", |manager| {
            let migration = add_subtask_migration::AddSubtaskMigration;
            Box::pin(async move { migration.up(manager).await })
        });
    }

    fn command_names(&self) -> Vec<&'static str> {
        vec![
            "list_todos",
            "create_todo",
            "update_todo",
            "delete_todo",
            "update_todo_details",
            "get_subtasks",
            "update_todo_parent",
            "get_caldav_status",
            "save_caldav_config",
            "clear_caldav_config",
            "sync_caldav_now",
        ]
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    fn register_ws_handlers(
        &self,
        registry: &mut crate::infrastructure::webserver::HandlerRegistry,
    ) {
        super::api::handlers::register_handlers(registry);
    }

    async fn initialize(&self, app_state: &AppState) -> Result<()> {
        // 创建到期通知调度器
        let scheduler = Arc::new(DueNotificationScheduler::new(
            app_state.db().clone(),
            Arc::new(app_state.notification().clone()),
        ));

        // 保存到 Feature 中
        self.scheduler
            .set(scheduler.clone())
            .map_err(|_| anyhow::anyhow!("Scheduler already initialized"))?;

        // 触发首次调度
        scheduler.reschedule().await;

        println!("[TodoFeature] Initialized with due notification scheduler");
        Ok(())
    }

    async fn cleanup(&self) -> Result<()> {
        println!("[TodoFeature] Cleaned up");
        Ok(())
    }
}

impl Default for TodoFeature {
    fn default() -> Self {
        Self {
            scheduler: OnceCell::new(),
        }
    }
}
