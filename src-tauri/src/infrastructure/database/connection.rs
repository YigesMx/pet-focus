use std::fs;
use std::time::Duration;

use anyhow::{Context, Result};
use directories::ProjectDirs;
use sea_orm::DatabaseConnection;
use sqlx::sqlite::SqliteConnectOptions;
use tauri::AppHandle;

const DB_FILENAME: &str = "pet_focus.sqlite";
const QUALIFIER: &str = "site";
const ORGANIZATION: &str = "yiges";
const APPLICATION: &str = "pet-focus";

/// 初始化数据库连接
///
/// 只负责创建连接和启用外键，不执行任何 Migration
/// Migration 由各个 Feature 通过 DatabaseRegistry 统一管理
pub async fn init_db(_app_handle: &AppHandle) -> Result<DatabaseConnection> {
    let project_dirs = ProjectDirs::from(QUALIFIER, ORGANIZATION, APPLICATION)
        .context("failed to resolve application data directory")?;
    let app_dir = project_dirs.data_dir();

    fs::create_dir_all(app_dir).context("failed to create application data directory")?;

    let db_path = app_dir.join(DB_FILENAME);

    // 使用 SqliteConnectOptions 配置 SQLite 连接，启用外键约束
    let sqlite_opt = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .foreign_keys(true); // 关键：在每个连接上启用外键约束

    // 使用 sqlx 的连接池配置，这会确保所有连接都应用相同的设置
    use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
    let pool: SqlitePool = SqlitePoolOptions::new()
        .max_connections(100)
        .min_connections(5)
        .acquire_timeout(Duration::from_secs(8))
        .connect_with(sqlite_opt)
        .await
        .context("failed to create connection pool")?;

    // 从 sqlx pool 创建 SeaORM DatabaseConnection
    let db: DatabaseConnection = pool.into();

    Ok(db)
}
