use anyhow::{Context, Result};
use sea_orm::{ConnectionTrait, Statement};
use sea_orm_migration::prelude::*;
use sea_orm_migration::MigrationTrait;

/// 添加 order_index 字段的迁移
#[derive(Debug, Clone, Copy)]
pub struct AddOrderIndexMigration;

impl MigrationName for AddOrderIndexMigration {
    fn name(&self) -> &str {
        "m20241209_000001_add_order_index"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for AddOrderIndexMigration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();

        // 添加 order_index 字段（浮点数类型）
        let _ = db
            .execute(Statement::from_string(
                backend,
                "ALTER TABLE todos ADD COLUMN order_index REAL".to_owned(),
            ))
            .await;

        // 为现有数据初始化 order_index
        // 按 parent_id 分组，每组内按 id 排序，从 10 开始，间隔 10
        // 先获取所有需要初始化的 todos
        let todos = db
            .query_all(Statement::from_string(
                backend,
                "SELECT id, parent_id FROM todos WHERE order_index IS NULL ORDER BY COALESCE(parent_id, -1), id".to_owned(),
            ))
            .await
            .context("failed to query todos")
            .map_err(|e| DbErr::Custom(e.to_string()))?;

        // 按 parent_id 分组并分配 order_index
        let mut current_parent: Option<i32> = None;
        let mut counter = 1;

        for row in todos {
            let id: i32 = row
                .try_get("", "id")
                .context("failed to get id")
                .map_err(|e| DbErr::Custom(e.to_string()))?;
            let parent_id: Option<i32> = row.try_get("", "parent_id").ok();

            // 如果 parent_id 改变，重置计数器
            if parent_id != current_parent {
                current_parent = parent_id;
                counter = 1;
            }

            let order_value = (counter as f64) * 10.0;

            db.execute(Statement::from_string(
                backend,
                format!(
                    "UPDATE todos SET order_index = {} WHERE id = {}",
                    order_value, id
                ),
            ))
            .await
            .context("failed to update order_index")
            .map_err(|e| DbErr::Custom(e.to_string()))?;

            counter += 1;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();

        // SQLite 不支持直接删除列，需要重建表
        // 这里简化处理，实际生产环境需要更复杂的逻辑
        let _ = db
            .execute(Statement::from_string(
                backend,
                "ALTER TABLE todos DROP COLUMN order_index".to_owned(),
            ))
            .await;

        Ok(())
    }
}
