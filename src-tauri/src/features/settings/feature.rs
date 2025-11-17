use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use sea_orm_migration::MigrationTrait;

use crate::core::{AppState, Feature};
use crate::infrastructure::database::DatabaseRegistry;

use super::data::migration;

pub struct SettingsFeature;

impl SettingsFeature {
    pub fn new() -> Arc<Self> {
        Arc::new(Self)
    }
}

#[async_trait]
impl Feature for SettingsFeature {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn name(&self) -> &'static str {
        "settings"
    }

    fn register_database(&self, registry: &mut DatabaseRegistry) {
        // 注册 Settings 数据表迁移
        registry.register_migration("settings_migration", |manager| {
            let migration = migration::SettingsMigration;
            Box::pin(async move { migration.up(manager).await })
        });
    }

    fn command_names(&self) -> Vec<&'static str> {
        vec!["get_theme_preference", "set_theme_preference"]
    }

    async fn initialize(&self, _app_state: &AppState) -> Result<()> {
        println!("[SettingsFeature] Initialized");
        Ok(())
    }
}

impl Default for SettingsFeature {
    fn default() -> Self {
        Self
    }
}
