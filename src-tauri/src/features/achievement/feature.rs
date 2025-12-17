use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use sea_orm_migration::MigrationTrait;

use crate::core::{AppState, Feature};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::infrastructure::webserver::HandlerRegistry;

/// 成就系统 Feature
///
/// 管理用户成就、金币和统计数据
pub struct AchievementFeature;

impl AchievementFeature {
    pub fn new() -> Arc<Self> {
        Arc::new(Self)
    }
}

#[async_trait]
impl Feature for AchievementFeature {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn name(&self) -> &'static str {
        "achievement"
    }

    fn command_names(&self) -> Vec<&'static str> {
        vec![
            "achievement_get_stats",
            "achievement_get_coins",
            "achievement_list",
            "achievement_list_transactions",
            "achievement_claim_daily_reward",
        ]
    }

    fn register_database(&self, registry: &mut crate::infrastructure::database::DatabaseRegistry) {
        use super::data::migration::{AchievementMigration, AchievementMigration2};
        
        registry.register_migration("achievement_migration", |manager| {
            let migration = AchievementMigration;
            Box::pin(async move { migration.up(manager).await })
        });
        
        registry.register_migration("achievement_migration_2", |manager| {
            let migration = AchievementMigration2;
            Box::pin(async move { migration.up(manager).await })
        });
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    fn register_ws_handlers(&self, registry: &mut HandlerRegistry) {
        super::api::handlers::register_handlers(self, registry);
    }

    async fn initialize(&self, _app_state: &AppState) -> Result<()> {
        println!("[AchievementFeature] Initialized");
        Ok(())
    }
}

impl Default for AchievementFeature {
    fn default() -> Self {
        Self
    }
}
