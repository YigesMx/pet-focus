use sea_orm::{ConnectionTrait, Schema};
use sea_orm_migration::prelude::*;
use sea_orm_migration::MigrationTrait;

use super::entities::{achievements, coin_transactions, user_stats};

#[derive(Debug, Clone, Copy)]
pub struct AchievementMigration;

impl MigrationName for AchievementMigration {
    fn name(&self) -> &str {
        "m20241217_000001_create_achievement_tables"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for AchievementMigration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();
        let schema = Schema::new(backend);

        // 创建 user_stats 表
        let mut create_user_stats = schema.create_table_from_entity(user_stats::Entity);
        create_user_stats.if_not_exists();
        db.execute(backend.build(&create_user_stats))
            .await
            .map_err(|e| DbErr::Custom(format!("failed to create user_stats table: {}", e)))?;

        // 创建 achievements 表
        let mut create_achievements = schema.create_table_from_entity(achievements::Entity);
        create_achievements.if_not_exists();
        db.execute(backend.build(&create_achievements))
            .await
            .map_err(|e| DbErr::Custom(format!("failed to create achievements table: {}", e)))?;

        // 创建 coin_transactions 表
        let mut create_coin_transactions =
            schema.create_table_from_entity(coin_transactions::Entity);
        create_coin_transactions.if_not_exists();
        db.execute(backend.build(&create_coin_transactions))
            .await
            .map_err(|e| {
                DbErr::Custom(format!("failed to create coin_transactions table: {}", e))
            })?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(coin_transactions::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(achievements::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(user_stats::Entity).to_owned())
            .await?;
        Ok(())
    }
}
