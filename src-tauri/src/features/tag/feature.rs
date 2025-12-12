use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use sea_orm_migration::MigrationTrait;

use crate::core::{AppState, Feature};
use crate::infrastructure::database::DatabaseRegistry;

use super::data::migration::TagMigration;

/// Tag Feature
///
/// 负责 Tag 标签功能的所有逻辑，包括：
/// - 数据库 Entity 和 Migration（tags, task_tags, session_tags）
/// - 标签 CRUD Commands
/// - 任务标签关联
/// - 番茄钟会话标签关联
pub struct TagFeature;

impl TagFeature {
    pub fn new() -> Arc<Self> {
        Arc::new(Self)
    }
}

#[async_trait]
impl Feature for TagFeature {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn name(&self) -> &'static str {
        "tag"
    }

    fn register_database(&self, registry: &mut DatabaseRegistry) {
        // 注册 Tag 数据表迁移（包含 tags, task_tags, session_tags）
        registry.register_migration("tag_migration", |manager| {
            let migration = TagMigration;
            Box::pin(async move { migration.up(manager).await })
        });
    }

    fn command_names(&self) -> Vec<&'static str> {
        vec![
            "tag_get_all",
            "tag_create",
            "tag_update",
            "tag_delete",
            "tag_get_for_task",
            "tag_set_for_task",
            "tag_get_for_session",
            "tag_set_for_session",
        ]
    }

    async fn initialize(&self, _app_state: &AppState) -> Result<()> {
        // Tag feature 不需要额外的初始化逻辑
        Ok(())
    }
}
