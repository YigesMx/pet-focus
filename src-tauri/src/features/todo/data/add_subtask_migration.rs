use anyhow::Context;
use sea_orm::{ConnectionTrait, DatabaseBackend, DbBackend, Statement};
use sea_orm_migration::prelude::*;

/// 为 Todo 添加子任务支持
/// 添加 parent_id 字段和自引用外键约束
#[derive(Debug, Clone, Copy)]
pub struct AddSubtaskMigration;

impl MigrationName for AddSubtaskMigration {
    fn name(&self) -> &str {
        "m20251117_000001_add_subtask_support"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for AddSubtaskMigration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();

        println!("Adding subtask support to todos table...");

        match backend {
            DbBackend::Sqlite => {
                // 检查 parent_id 列是否已存在
                let check_column = db.query_one(Statement::from_string(
                    DatabaseBackend::Sqlite,
                    "SELECT COUNT(*) as count FROM pragma_table_info('todos') WHERE name='parent_id';".to_string(),
                ))
                .await;

                let column_exists = if let Ok(Some(row)) = check_column {
                    let count: i32 = row.try_get("", "count").unwrap_or(0);
                    count > 0
                } else {
                    false
                };

                if !column_exists {
                    println!("  -> Adding parent_id column with foreign key constraint...");
                    // SQLite 不支持 ALTER TABLE ADD FOREIGN KEY，需要重建表
                    db.execute(Statement::from_string(
                        DatabaseBackend::Sqlite,
                        r#"
                        -- 1. 创建带外键约束的新表
                        CREATE TABLE todos_new (
                            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                            parent_id INTEGER,
                            uid TEXT NOT NULL,
                            title TEXT NOT NULL,
                            description TEXT,
                            completed INTEGER NOT NULL DEFAULT 0,
                            status TEXT NOT NULL DEFAULT 'NEEDS-ACTION',
                            percent_complete INTEGER,
                            priority INTEGER,
                            location TEXT,
                            tags TEXT,
                            created_date TIMESTAMP_WITH_TIMEZONE_TEXT NOT NULL,
                            modified_date TIMESTAMP_WITH_TIMEZONE_TEXT NOT NULL,
                            due_date TIMESTAMP_WITH_TIMEZONE_TEXT,
                            recurrence_rule TEXT,
                            remind_before_minutes INTEGER NOT NULL DEFAULT 15,
                            timezone TEXT,
                            reminder_method TEXT,
                            reminder_last_triggered_at TIMESTAMP_WITH_TIMEZONE_TEXT,
                            completed_at TIMESTAMP_WITH_TIMEZONE_TEXT,
                            notified INTEGER NOT NULL DEFAULT 0,
                            dirty INTEGER NOT NULL DEFAULT 0,
                            remote_url TEXT,
                            remote_etag TEXT,
                            remote_calendar_url TEXT,
                            sync_token TEXT,
                            last_synced_at TIMESTAMP_WITH_TIMEZONE_TEXT,
                            deleted_at TIMESTAMP_WITH_TIMEZONE_TEXT,
                            created_at TIMESTAMP_WITH_TIMEZONE_TEXT NOT NULL,
                            updated_at TIMESTAMP_WITH_TIMEZONE_TEXT NOT NULL,
                            FOREIGN KEY (parent_id) 
                                REFERENCES todos(id) 
                                ON DELETE CASCADE
                        );
                        
                        -- 2. 复制数据
                        INSERT INTO todos_new 
                            (id, uid, title, description, completed, status, percent_complete, priority, location, tags,
                             created_date, modified_date, due_date, recurrence_rule, remind_before_minutes, timezone,
                             reminder_method, reminder_last_triggered_at, completed_at, notified, dirty,
                             remote_url, remote_etag, remote_calendar_url, sync_token, last_synced_at, deleted_at,
                             created_at, updated_at)
                        SELECT 
                            id, uid, title, description, completed, status, percent_complete, priority, location, tags,
                            created_date, modified_date, due_date, recurrence_rule, remind_before_minutes, timezone,
                            reminder_method, reminder_last_triggered_at, completed_at, notified, dirty,
                            remote_url, remote_etag, remote_calendar_url, sync_token, last_synced_at, deleted_at,
                            created_at, updated_at
                        FROM todos;
                        
                        -- 3. 删除旧表
                        DROP TABLE todos;
                        
                        -- 4. 重命名新表
                        ALTER TABLE todos_new RENAME TO todos;
                        "#.to_string(),
                    ))
                    .await
                    .context("failed to add parent_id column with foreign key")
                    .map_err(|e| DbErr::Custom(e.to_string()))?;

                    println!(
                        "  -> Successfully added parent_id column with foreign key constraint"
                    );
                } else {
                    println!("  -> Column already exists, skipping...");
                }
            }
            _ => {
                return Err(DbErr::Custom("Unsupported database backend".to_string()));
            }
        }

        println!("Subtask support migration completed successfully!");
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        println!("Removing parent_id column...");
        db.execute(Statement::from_string(
            DatabaseBackend::Sqlite,
            r#"
            CREATE TABLE todos_backup AS SELECT 
                id, uid, title, description, completed, status, percent_complete, priority, location, tags,
                created_date, modified_date, due_date, recurrence_rule, remind_before_minutes, timezone,
                reminder_method, reminder_last_triggered_at, completed_at, notified, dirty,
                remote_url, remote_etag, remote_calendar_url, sync_token, last_synced_at, deleted_at,
                created_at, updated_at
            FROM todos;
            DROP TABLE todos;
            ALTER TABLE todos_backup RENAME TO todos;
            "#.to_string(),
        ))
        .await?;

        Ok(())
    }
}
