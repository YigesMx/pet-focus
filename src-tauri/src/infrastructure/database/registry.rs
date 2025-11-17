use anyhow::Result;
use sea_orm_migration::prelude::*;
use std::future::Future;
use std::pin::Pin;

/// Migration 函数类型 - 使用 for<'a> 来处理生命周期
type MigrationFn = Box<
    dyn for<'a> Fn(
            &'a SchemaManager<'a>,
        ) -> Pin<Box<dyn Future<Output = Result<(), DbErr>> + Send + 'a>>
        + Send
        + Sync,
>;

/// 数据库注册表
///
/// 用于收集所有 Features 注册的 Migrations，并统一执行
pub struct DatabaseRegistry {
    migrations: Vec<(&'static str, MigrationFn)>,
}

impl DatabaseRegistry {
    pub fn new() -> Self {
        Self {
            migrations: Vec::new(),
        }
    }

    /// 注册一个 Migration
    pub fn register_migration<F>(&mut self, name: &'static str, migration_fn: F)
    where
        F: for<'a> Fn(
                &'a SchemaManager<'a>,
            ) -> Pin<Box<dyn Future<Output = Result<(), DbErr>> + Send + 'a>>
            + Send
            + Sync
            + 'static,
    {
        self.migrations.push((name, Box::new(migration_fn)));
    }

    /// 执行所有已注册的 Migrations
    pub async fn run_migrations(&self, db: &sea_orm::DatabaseConnection) -> Result<()> {
        let manager = SchemaManager::new(db);

        for (name, migration_fn) in &self.migrations {
            println!("Running migration: {}", name);
            migration_fn(&manager)
                .await
                .map_err(|e| anyhow::anyhow!("Migration '{}' failed: {}", name, e))?;
        }

        Ok(())
    }
}

impl Default for DatabaseRegistry {
    fn default() -> Self {
        Self::new()
    }
}
