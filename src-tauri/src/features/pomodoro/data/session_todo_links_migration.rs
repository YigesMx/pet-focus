use anyhow::Context;
use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
use sea_orm_migration::prelude::*;

/// 创建 session_todo_links 表（Session 与 Todo 的多对多关联）
#[derive(Debug, Clone, Copy)]
pub struct SessionTodoLinksMigration;

impl MigrationName for SessionTodoLinksMigration {
    fn name(&self) -> &str {
        "m20250116_000001_create_session_todo_links"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for SessionTodoLinksMigration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        // 检查表是否已存在
        let check_result = db
            .query_one(Statement::from_string(
                DatabaseBackend::Sqlite,
                "SELECT name FROM sqlite_master WHERE type='table' AND name='session_todo_links';"
                    .to_string(),
            ))
            .await;

        if check_result.is_ok() && check_result.unwrap().is_some() {
            println!("  -> session_todo_links table already exists, skipping...");
            return Ok(());
        }

        println!("Creating session_todo_links table...");

        // 创建表
        manager
            .create_table(
                Table::create()
                    .table(SessionTodoLinks::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(SessionTodoLinks::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(SessionTodoLinks::SessionId)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SessionTodoLinks::TodoId)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SessionTodoLinks::SortOrder)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(SessionTodoLinks::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_session_todo_links_session")
                            .from(SessionTodoLinks::Table, SessionTodoLinks::SessionId)
                            .to(PomodoroSessions::Table, PomodoroSessions::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_session_todo_links_todo")
                            .from(SessionTodoLinks::Table, SessionTodoLinks::TodoId)
                            .to(Todos::Table, Todos::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
            .context("Failed to create session_todo_links table")
            .map_err(|e| DbErr::Custom(e.to_string()))?;

        // 创建唯一索引（防止重复关联）
        manager
            .create_index(
                Index::create()
                    .name("idx_session_todo_links_unique")
                    .table(SessionTodoLinks::Table)
                    .col(SessionTodoLinks::SessionId)
                    .col(SessionTodoLinks::TodoId)
                    .unique()
                    .to_owned(),
            )
            .await
            .context("Failed to create unique index")
            .map_err(|e| DbErr::Custom(e.to_string()))?;

        // 创建索引（加速按 session 查询）
        manager
            .create_index(
                Index::create()
                    .name("idx_session_todo_links_session")
                    .table(SessionTodoLinks::Table)
                    .col(SessionTodoLinks::SessionId)
                    .to_owned(),
            )
            .await
            .context("Failed to create session index")
            .map_err(|e| DbErr::Custom(e.to_string()))?;

        println!("  -> session_todo_links table created successfully");
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(SessionTodoLinks::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum SessionTodoLinks {
    Table,
    Id,
    SessionId,
    TodoId,
    SortOrder,
    CreatedAt,
}

#[derive(Iden)]
enum PomodoroSessions {
    Table,
    Id,
}

#[derive(Iden)]
enum Todos {
    Table,
    Id,
}
