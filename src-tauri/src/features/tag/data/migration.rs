use anyhow::Context;
use sea_orm::{ConnectionTrait, Schema, Statement};
use sea_orm_migration::prelude::*;
use sea_orm_migration::MigrationTrait;

use super::{entity, session_tag_entity, task_tag_entity};

/// Tag 相关数据表迁移
#[derive(Debug, Clone, Copy)]
pub struct TagMigration;

impl MigrationName for TagMigration {
    fn name(&self) -> &str {
        "m20250112_000001_create_tag_tables"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for TagMigration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();
        let schema = Schema::new(backend);

        // 创建 tags 表
        let mut create_tags = schema.create_table_from_entity(entity::Entity);
        create_tags.if_not_exists();
        db.execute(backend.build(&create_tags))
            .await
            .context("failed to create tags table")
            .map_err(|e| DbErr::Custom(e.to_string()))?;

        // 创建 task_tags 关联表
        let mut create_task_tags = schema.create_table_from_entity(task_tag_entity::Entity);
        create_task_tags.if_not_exists();
        db.execute(backend.build(&create_task_tags))
            .await
            .context("failed to create task_tags table")
            .map_err(|e| DbErr::Custom(e.to_string()))?;

        // 创建 session_tags 关联表
        let mut create_session_tags = schema.create_table_from_entity(session_tag_entity::Entity);
        create_session_tags.if_not_exists();
        db.execute(backend.build(&create_session_tags))
            .await
            .context("failed to create session_tags table")
            .map_err(|e| DbErr::Custom(e.to_string()))?;

        // 创建索引（如果不存在）
        let index_statements = [
            "CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)",
            "CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id)",
            "CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id)",
            "CREATE INDEX IF NOT EXISTS idx_session_tags_session_id ON session_tags(session_id)",
            "CREATE INDEX IF NOT EXISTS idx_session_tags_tag_id ON session_tags(tag_id)",
        ];

        for stmt in index_statements {
            let _ = db
                .execute(Statement::from_string(backend, stmt.to_owned()))
                .await;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();

        // 按依赖顺序删除表
        let drop_statements = [
            "DROP TABLE IF EXISTS session_tags",
            "DROP TABLE IF EXISTS task_tags",
            "DROP TABLE IF EXISTS tags",
        ];

        for stmt in drop_statements {
            db.execute(Statement::from_string(backend, stmt.to_owned()))
                .await
                .map_err(|e| DbErr::Custom(e.to_string()))?;
        }

        Ok(())
    }
}
