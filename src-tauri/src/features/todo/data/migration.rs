use anyhow::{Context, Result};
use sea_orm::{ConnectionTrait, Schema, Statement};
use sea_orm_migration::prelude::*;
use sea_orm_migration::MigrationTrait;

use super::entity;

/// Todo 数据表迁移
#[derive(Debug, Clone, Copy)]
pub struct TodoMigration;

impl MigrationName for TodoMigration {
    fn name(&self) -> &str {
        "m20240101_000001_create_todo_table"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for TodoMigration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();
        let schema = Schema::new(backend);

        // 创建 todos 表
        let mut create_todos = schema.create_table_from_entity(entity::Entity);
        create_todos.if_not_exists();

        db.execute(backend.build(&create_todos))
            .await
            .context("failed to create todos table")
            .map_err(|e| DbErr::Custom(e.to_string()))?;

        // 添加新字段到 todos 表（如果不存在）
        let check_columns = db
            .query_one(Statement::from_string(
                backend,
                "PRAGMA table_info(todos)".to_owned(),
            ))
            .await
            .ok();

        // 如果表已存在但缺少新字段，则添加它们
        if check_columns.is_some() {
            let alter_statements = [
                "ALTER TABLE todos ADD COLUMN created_date TEXT",
                "ALTER TABLE todos ADD COLUMN modified_date TEXT",
                "ALTER TABLE todos ADD COLUMN due_date TEXT",
                "ALTER TABLE todos ADD COLUMN remind_before_minutes INTEGER DEFAULT 15",
                "ALTER TABLE todos ADD COLUMN notified INTEGER DEFAULT 0",
                "ALTER TABLE todos ADD COLUMN uid TEXT",
                "ALTER TABLE todos ADD COLUMN description TEXT",
                "ALTER TABLE todos ADD COLUMN status TEXT DEFAULT 'NEEDS-ACTION'",
                "ALTER TABLE todos ADD COLUMN percent_complete INTEGER",
                "ALTER TABLE todos ADD COLUMN priority INTEGER",
                "ALTER TABLE todos ADD COLUMN location TEXT",
                "ALTER TABLE todos ADD COLUMN tags TEXT",
                "ALTER TABLE todos ADD COLUMN recurrence_rule TEXT",
                "ALTER TABLE todos ADD COLUMN reminder_method TEXT",
                "ALTER TABLE todos ADD COLUMN reminder_last_triggered_at TEXT",
                "ALTER TABLE todos ADD COLUMN timezone TEXT",
                "ALTER TABLE todos ADD COLUMN completed_at TEXT",
                "ALTER TABLE todos ADD COLUMN dirty INTEGER DEFAULT 0",
                "ALTER TABLE todos ADD COLUMN remote_url TEXT",
                "ALTER TABLE todos ADD COLUMN remote_etag TEXT",
                "ALTER TABLE todos ADD COLUMN remote_calendar_url TEXT",
                "ALTER TABLE todos ADD COLUMN sync_token TEXT",
                "ALTER TABLE todos ADD COLUMN last_synced_at TEXT",
                "ALTER TABLE todos ADD COLUMN deleted_at TEXT",
            ];

            for stmt in alter_statements {
                let _ = db
                    .execute(Statement::from_string(backend, stmt.to_owned()))
                    .await;
            }
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(entity::Entity).to_owned())
            .await
    }
}
