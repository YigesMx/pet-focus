use anyhow::Result;
use sea_orm::{ConnectionTrait, Schema};
use sea_orm_migration::prelude::*;
use sea_orm_migration::MigrationTrait;

use super::entity;

#[derive(Debug, Clone, Copy)]
pub struct SettingsMigration;

impl MigrationName for SettingsMigration {
    fn name(&self) -> &str {
        "m20240101_000002_create_setting_table"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for SettingsMigration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();
        let schema = Schema::new(backend);

        let mut create_settings = schema.create_table_from_entity(entity::Entity);
        create_settings.if_not_exists();

        db.execute(backend.build(&create_settings))
            .await
            .map_err(|e| DbErr::Custom(format!("failed to create settings table: {}", e)))?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(entity::Entity).to_owned())
            .await
    }
}
