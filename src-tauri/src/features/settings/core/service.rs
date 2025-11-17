use anyhow::Result;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};

use crate::features::settings::data::entity::{self, Entity as SettingEntity};

pub struct SettingService;

impl SettingService {
    /// 获取设置值
    pub async fn get(db: &DatabaseConnection, key: &str) -> Result<Option<String>> {
        let setting = SettingEntity::find()
            .filter(entity::Column::Key.eq(key))
            .one(db)
            .await?;

        Ok(setting.map(|s| s.value))
    }

    /// 获取设置值，如果不存在则返回默认值
    pub async fn get_or_default(
        db: &DatabaseConnection,
        key: &str,
        default: &str,
    ) -> Result<String> {
        Ok(Self::get(db, key)
            .await?
            .unwrap_or_else(|| default.to_string()))
    }

    /// 设置值
    pub async fn set(db: &DatabaseConnection, key: &str, value: &str) -> Result<entity::Model> {
        let now = chrono::Utc::now();

        // 尝试查找现有设置
        let existing = SettingEntity::find()
            .filter(entity::Column::Key.eq(key))
            .one(db)
            .await?;

        let model = if let Some(existing_model) = existing {
            // 更新现有设置
            let mut active_model: entity::ActiveModel = existing_model.into();
            active_model.value = Set(value.to_string());
            active_model.updated_at = Set(now);
            active_model.update(db).await?
        } else {
            // 创建新设置
            let active_model = entity::ActiveModel {
                key: Set(key.to_string()),
                value: Set(value.to_string()),
                created_at: Set(now),
                updated_at: Set(now),
            };
            active_model.insert(db).await?
        };

        Ok(model.into())
    }

    /// 删除设置
    pub async fn delete(db: &DatabaseConnection, key: &str) -> Result<bool> {
        let result = SettingEntity::delete_many()
            .filter(entity::Column::Key.eq(key))
            .exec(db)
            .await?;

        Ok(result.rows_affected > 0)
    }

    /// 列出所有设置
    #[allow(dead_code)]
    pub async fn list(db: &DatabaseConnection) -> Result<Vec<entity::Model>> {
        let settings = SettingEntity::find().all(db).await?;
        Ok(settings.into_iter().map(|s| s.into()).collect())
    }

    /// 获取布尔值设置
    pub async fn get_bool(db: &DatabaseConnection, key: &str, default: bool) -> Result<bool> {
        let value = Self::get_or_default(db, key, &default.to_string()).await?;
        Ok(value.parse::<bool>().unwrap_or(default))
    }

    /// 设置布尔值
    pub async fn set_bool(
        db: &DatabaseConnection,
        key: &str,
        value: bool,
    ) -> Result<entity::Model> {
        Self::set(db, key, &value.to_string()).await
    }
}
