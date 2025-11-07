use std::fs;

use anyhow::{Context, Result};
use directories::ProjectDirs;
use sea_orm::{ConnectionTrait, Database, DatabaseConnection, DbBackend, Schema, Statement};
use tauri::AppHandle;

use super::entities::{setting, todo};

const DB_FILENAME: &str = "pet_focus.sqlite";
const QUALIFIER: &str = "site";
const ORGANIZATION: &str = "yiges";
const APPLICATION: &str = "pet-focus";

pub async fn init_db(_app_handle: &AppHandle) -> Result<DatabaseConnection> {
    let project_dirs = ProjectDirs::from(QUALIFIER, ORGANIZATION, APPLICATION)
        .context("failed to resolve application data directory")?;
    let app_dir = project_dirs.data_dir();

    fs::create_dir_all(app_dir).context("failed to create application data directory")?;

    let db_path = app_dir.join(DB_FILENAME);
    let path = db_path.to_string_lossy().replace('\u{5c}', "/");
    let connection_url = format!("sqlite://{}?mode=rwc", path);

    let db = Database::connect(&connection_url)
        .await
        .with_context(|| format!("failed to connect to database at {}", connection_url))?;

    enable_foreign_keys(&db).await?;
    run_migrations(&db).await?;

    Ok(db)
}

async fn enable_foreign_keys(db: &DatabaseConnection) -> Result<()> {
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "PRAGMA foreign_keys = ON".to_owned(),
    ))
    .await
    .context("failed to enable foreign key support")?;

    Ok(())
}

async fn run_migrations(db: &DatabaseConnection) -> Result<()> {
    let backend = db.get_database_backend();
    let schema = Schema::new(backend);

    // 创建 todos 表
    let mut create_todos = schema.create_table_from_entity(todo::Entity);
    create_todos.if_not_exists();

    db.execute(backend.build(&create_todos))
        .await
        .context("failed to create todos table")?;

    // 添加新字段到 todos 表（如果不存在）
    // 检查字段是否存在，如果不存在则添加
    let check_columns = db
        .query_one(Statement::from_string(
            backend,
            "PRAGMA table_info(todos)".to_owned(),
        ))
        .await
        .ok();

    // 如果表已存在但缺少新字段，则添加它们
    if check_columns.is_some() {
        // 逐个添加缺失字段（忽略已存在的错误）
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

        // 为旧数据设置默认值（使用 created_at 的值）
        let _ = db
            .execute(Statement::from_string(
                backend,
                "UPDATE todos SET created_date = created_at WHERE created_date IS NULL".to_owned(),
            ))
            .await;

        let _ = db
            .execute(Statement::from_string(
                backend,
                "UPDATE todos SET modified_date = updated_at WHERE modified_date IS NULL"
                    .to_owned(),
            ))
            .await;

        let _ = db
            .execute(Statement::from_string(
                backend,
                "UPDATE todos SET status = 'NEEDS-ACTION' WHERE status IS NULL".to_owned(),
            ))
            .await;

        let _ = db
            .execute(Statement::from_string(
                backend,
                "UPDATE todos SET uid = printf('local-%s', id) WHERE uid IS NULL OR uid = ''"
                    .to_owned(),
            ))
            .await;
    }

    // 创建 settings 表
    let mut create_settings = schema.create_table_from_entity(setting::Entity);
    create_settings.if_not_exists();

    db.execute(backend.build(&create_settings))
        .await
        .context("failed to create settings table")?;

    Ok(())
}
