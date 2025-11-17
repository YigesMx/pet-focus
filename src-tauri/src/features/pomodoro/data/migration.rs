use anyhow::Context;
use sea_orm::{ConnectionTrait, Schema};
use sea_orm_migration::prelude::*;
use sea_orm_migration::MigrationTrait;

use super::entity;

#[derive(Debug, Clone, Copy)]
pub struct PomodoroMigration;

impl MigrationName for PomodoroMigration {
    fn name(&self) -> &str {
        "m20250101_000100_create_pomodoro_sessions"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for PomodoroMigration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();
        let schema = Schema::new(backend);

        let mut create = schema.create_table_from_entity(entity::Entity);
        create.if_not_exists();

        db.execute(backend.build(&create))
            .await
            .context("failed to create pomodoro_sessions table")
            .map_err(|e| DbErr::Custom(e.to_string()))?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(entity::Entity).to_owned())
            .await
    }
}
