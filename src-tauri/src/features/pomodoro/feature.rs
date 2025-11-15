use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;

use crate::core::{AppState, Feature};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::infrastructure::webserver::HandlerRegistry;

use tokio::sync::OnceCell;
use sea_orm_migration::MigrationTrait;

/// Pomodoro Feature（预留）
/// 
/// 未来将实现番茄钟功能
pub struct PomodoroFeature {
    manager: OnceCell<Arc<super::core::scheduler::PomodoroManager>>,
}

impl PomodoroFeature {
    pub fn new() -> Arc<Self> {
        Arc::new(Self { manager: OnceCell::new() })
    }

    pub fn manager(&self) -> Option<&Arc<super::core::scheduler::PomodoroManager>> {
        self.manager.get()
    }
}

#[async_trait]
impl Feature for PomodoroFeature {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
    
    fn name(&self) -> &'static str {
        "pomodoro"
    }

    fn command_names(&self) -> Vec<&'static str> {
        vec![
            "pomodoro_start",
            "pomodoro_pause",
            "pomodoro_resume",
            "pomodoro_skip",
            "pomodoro_stop",
            "pomodoro_status",
            "pomodoro_get_config",
            "pomodoro_set_config",
        ]
    }

    async fn initialize(&self, _app_state: &AppState) -> Result<()> {
        // 初始化 PomodoroManager（含通知与 AppHandle，用于托盘 tooltip 与事件广播）
        let manager = Arc::new(super::core::scheduler::PomodoroManager::new(
            _app_state.app_handle(),
            _app_state.notification().clone(),
        ));
        self.manager
            .set(manager)
            .map_err(|_| anyhow::anyhow!("PomodoroManager already initialized"))?;

        println!("[PomodoroFeature] Initialized");
        Ok(())
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    fn register_ws_handlers(&self, registry: &mut HandlerRegistry) {
        super::api::handlers::register_handlers(self, registry);
    }

    fn register_database(&self, registry: &mut crate::infrastructure::database::DatabaseRegistry) {
        // 创建 Pomodoro 会话表（旧迁移，保留兼容）
        registry.register_migration("pomodoro_migration", |manager| {
            let migration = super::data::migration::PomodoroMigration;
            Box::pin(async move { migration.up(manager).await })
        });
        
        // 重构数据库结构（新迁移）
        registry.register_migration("pomodoro_restructure_migration", |manager| {
            let migration = super::data::restructure_migration::PomodoroRestructureMigration;
            Box::pin(async move { migration.up(manager).await })
        });
    }
}

impl Default for PomodoroFeature {
    fn default() -> Self {
        Self { manager: OnceCell::new() }
    }
}
