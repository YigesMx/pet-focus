use anyhow::{Context, Result};
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};

use super::{entity, session_tag_entity, task_tag_entity};

pub struct TagRepository;

impl TagRepository {
    // ========== Tag CRUD ==========

    /// 获取所有标签
    pub async fn get_all_tags(db: &DatabaseConnection) -> Result<Vec<entity::Model>> {
        entity::Entity::find()
            .order_by_asc(entity::Column::Name)
            .all(db)
            .await
            .context("failed to get all tags")
    }

    /// 根据 ID 获取标签
    pub async fn get_tag_by_id(db: &DatabaseConnection, id: i32) -> Result<Option<entity::Model>> {
        entity::Entity::find_by_id(id)
            .one(db)
            .await
            .context("failed to get tag by id")
    }

    /// 根据名称获取标签
    pub async fn get_tag_by_name(
        db: &DatabaseConnection,
        name: &str,
    ) -> Result<Option<entity::Model>> {
        entity::Entity::find()
            .filter(entity::Column::Name.eq(name))
            .one(db)
            .await
            .context("failed to get tag by name")
    }

    /// 创建标签
    pub async fn create_tag(
        db: &DatabaseConnection,
        name: &str,
        color: Option<&str>,
    ) -> Result<entity::Model> {
        let now = Utc::now();
        let active_model = entity::ActiveModel {
            name: Set(name.to_string()),
            color: Set(color.map(|s| s.to_string())),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };

        active_model
            .insert(db)
            .await
            .context("failed to create tag")
    }

    /// 获取或创建标签（根据名称）
    pub async fn get_or_create_tag(
        db: &DatabaseConnection,
        name: &str,
        color: Option<&str>,
    ) -> Result<entity::Model> {
        if let Some(existing) = Self::get_tag_by_name(db, name).await? {
            return Ok(existing);
        }
        Self::create_tag(db, name, color).await
    }

    /// 更新标签
    pub async fn update_tag(
        db: &DatabaseConnection,
        id: i32,
        name: Option<&str>,
        color: Option<Option<&str>>,
    ) -> Result<entity::Model> {
        let tag = entity::Entity::find_by_id(id)
            .one(db)
            .await
            .context("failed to find tag")?
            .context("tag not found")?;

        let mut active_model: entity::ActiveModel = tag.into();
        active_model.updated_at = Set(Utc::now());

        if let Some(name) = name {
            active_model.name = Set(name.to_string());
        }
        if let Some(color) = color {
            active_model.color = Set(color.map(|s| s.to_string()));
        }

        active_model
            .update(db)
            .await
            .context("failed to update tag")
    }

    /// 删除标签（级联删除关联记录并更新 task 的 tags 字段）
    pub async fn delete_tag(db: &DatabaseConnection, id: i32) -> Result<()> {
        // 1. 获取标签名称（用于更新 task 的 tags 字段）
        let tag = entity::Entity::find_by_id(id)
            .one(db)
            .await
            .context("failed to find tag")?
            .context("tag not found")?;
        let tag_name = tag.name.clone();

        // 2. 获取所有关联此标签的 task_id
        let task_tags = task_tag_entity::Entity::find()
            .filter(task_tag_entity::Column::TagId.eq(id))
            .all(db)
            .await
            .context("failed to get task tags for deletion")?;
        let task_ids: Vec<i32> = task_tags.iter().map(|tt| tt.task_id).collect();

        // 3. 删除 task_tags 关联记录
        task_tag_entity::Entity::delete_many()
            .filter(task_tag_entity::Column::TagId.eq(id))
            .exec(db)
            .await
            .context("failed to delete task_tags")?;

        // 4. 删除 session_tags 关联记录
        session_tag_entity::Entity::delete_many()
            .filter(session_tag_entity::Column::TagId.eq(id))
            .exec(db)
            .await
            .context("failed to delete session_tags")?;

        // 5. 更新相关 task 的 tags 字段（移除该标签名）
        if !task_ids.is_empty() {
            use crate::features::todo::data::entity as todo_entity;
            
            for task_id in task_ids {
                if let Ok(Some(task)) = todo_entity::Entity::find_by_id(task_id).one(db).await {
                    if let Some(tags_str) = &task.tags {
                        // 解析逗号分隔的标签，移除匹配的标签名
                        let new_tags: Vec<&str> = tags_str
                            .split(',')
                            .map(|s| s.trim())
                            .filter(|s| !s.is_empty() && s.to_lowercase() != tag_name.to_lowercase())
                            .collect();
                        
                        let new_tags_str = if new_tags.is_empty() {
                            None
                        } else {
                            Some(new_tags.join(", "))
                        };
                        
                        // 更新 task 的 tags 字段
                        let mut task_model: todo_entity::ActiveModel = task.into();
                        task_model.tags = Set(new_tags_str);
                        task_model.updated_at = Set(Utc::now());
                        task_model.update(db).await.ok(); // 忽略单个更新失败
                    }
                }
            }
        }

        // 6. 删除标签本身
        entity::Entity::delete_by_id(id)
            .exec(db)
            .await
            .context("failed to delete tag")?;
        
        Ok(())
    }

    // ========== Task-Tag 关联 ==========

    /// 获取任务的所有标签
    pub async fn get_tags_for_task(
        db: &DatabaseConnection,
        task_id: i32,
    ) -> Result<Vec<entity::Model>> {
        let task_tags = task_tag_entity::Entity::find()
            .filter(task_tag_entity::Column::TaskId.eq(task_id))
            .all(db)
            .await
            .context("failed to get task tags")?;

        let tag_ids: Vec<i32> = task_tags.iter().map(|tt| tt.tag_id).collect();
        if tag_ids.is_empty() {
            return Ok(vec![]);
        }

        entity::Entity::find()
            .filter(entity::Column::Id.is_in(tag_ids))
            .order_by_asc(entity::Column::Name)
            .all(db)
            .await
            .context("failed to get tags for task")
    }

    /// 设置任务的标签（替换所有）
    pub async fn set_tags_for_task(
        db: &DatabaseConnection,
        task_id: i32,
        tag_ids: Vec<i32>,
    ) -> Result<()> {
        // 删除现有关联
        task_tag_entity::Entity::delete_many()
            .filter(task_tag_entity::Column::TaskId.eq(task_id))
            .exec(db)
            .await
            .context("failed to remove existing task tags")?;

        // 创建新关联
        let now = Utc::now();
        for tag_id in tag_ids {
            let active_model = task_tag_entity::ActiveModel {
                task_id: Set(task_id),
                tag_id: Set(tag_id),
                created_at: Set(now),
            };
            active_model
                .insert(db)
                .await
                .context("failed to add task tag")?;
        }

        Ok(())
    }

    /// 添加任务标签
    pub async fn add_tag_to_task(
        db: &DatabaseConnection,
        task_id: i32,
        tag_id: i32,
    ) -> Result<()> {
        // 检查是否已存在
        let existing = task_tag_entity::Entity::find()
            .filter(task_tag_entity::Column::TaskId.eq(task_id))
            .filter(task_tag_entity::Column::TagId.eq(tag_id))
            .one(db)
            .await
            .context("failed to check existing task tag")?;

        if existing.is_none() {
            let active_model = task_tag_entity::ActiveModel {
                task_id: Set(task_id),
                tag_id: Set(tag_id),
                created_at: Set(Utc::now()),
            };
            active_model
                .insert(db)
                .await
                .context("failed to add task tag")?;
        }

        Ok(())
    }

    /// 移除任务标签
    pub async fn remove_tag_from_task(
        db: &DatabaseConnection,
        task_id: i32,
        tag_id: i32,
    ) -> Result<()> {
        task_tag_entity::Entity::delete_many()
            .filter(task_tag_entity::Column::TaskId.eq(task_id))
            .filter(task_tag_entity::Column::TagId.eq(tag_id))
            .exec(db)
            .await
            .context("failed to remove task tag")?;
        Ok(())
    }

    // ========== Session-Tag 关联 ==========

    /// 获取 Session 的所有标签
    pub async fn get_tags_for_session(
        db: &DatabaseConnection,
        session_id: i32,
    ) -> Result<Vec<entity::Model>> {
        let session_tags = session_tag_entity::Entity::find()
            .filter(session_tag_entity::Column::SessionId.eq(session_id))
            .all(db)
            .await
            .context("failed to get session tags")?;

        let tag_ids: Vec<i32> = session_tags.iter().map(|st| st.tag_id).collect();
        if tag_ids.is_empty() {
            return Ok(vec![]);
        }

        entity::Entity::find()
            .filter(entity::Column::Id.is_in(tag_ids))
            .order_by_asc(entity::Column::Name)
            .all(db)
            .await
            .context("failed to get tags for session")
    }

    /// 设置 Session 的标签（替换所有）
    pub async fn set_tags_for_session(
        db: &DatabaseConnection,
        session_id: i32,
        tag_ids: Vec<i32>,
    ) -> Result<()> {
        // 删除现有关联
        session_tag_entity::Entity::delete_many()
            .filter(session_tag_entity::Column::SessionId.eq(session_id))
            .exec(db)
            .await
            .context("failed to remove existing session tags")?;

        // 创建新关联
        let now = Utc::now();
        for tag_id in tag_ids {
            let active_model = session_tag_entity::ActiveModel {
                session_id: Set(session_id),
                tag_id: Set(tag_id),
                created_at: Set(now),
            };
            active_model
                .insert(db)
                .await
                .context("failed to add session tag")?;
        }

        Ok(())
    }

    /// 添加 Session 标签
    pub async fn add_tag_to_session(
        db: &DatabaseConnection,
        session_id: i32,
        tag_id: i32,
    ) -> Result<()> {
        // 检查是否已存在
        let existing = session_tag_entity::Entity::find()
            .filter(session_tag_entity::Column::SessionId.eq(session_id))
            .filter(session_tag_entity::Column::TagId.eq(tag_id))
            .one(db)
            .await
            .context("failed to check existing session tag")?;

        if existing.is_none() {
            let active_model = session_tag_entity::ActiveModel {
                session_id: Set(session_id),
                tag_id: Set(tag_id),
                created_at: Set(Utc::now()),
            };
            active_model
                .insert(db)
                .await
                .context("failed to add session tag")?;
        }

        Ok(())
    }

    /// 移除 Session 标签
    pub async fn remove_tag_from_session(
        db: &DatabaseConnection,
        session_id: i32,
        tag_id: i32,
    ) -> Result<()> {
        session_tag_entity::Entity::delete_many()
            .filter(session_tag_entity::Column::SessionId.eq(session_id))
            .filter(session_tag_entity::Column::TagId.eq(tag_id))
            .exec(db)
            .await
            .context("failed to remove session tag")?;
        Ok(())
    }

    // ========== CalDAV Tags 同步辅助 ==========

    /// 从 CalDAV tags 字符串同步到多对多表
    /// 会创建不存在的 tag，并更新关联关系
    pub async fn sync_tags_from_caldav(
        db: &DatabaseConnection,
        task_id: i32,
        caldav_tags: &str,
    ) -> Result<Vec<entity::Model>> {
        // 解析 CalDAV tags（逗号分隔）
        let tag_names: Vec<&str> = caldav_tags
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        let mut tag_ids = Vec::new();
        let mut tags = Vec::new();

        for name in tag_names {
            let tag = Self::get_or_create_tag(db, name, None).await?;
            tag_ids.push(tag.id);
            tags.push(tag);
        }

        // 设置任务的标签
        Self::set_tags_for_task(db, task_id, tag_ids).await?;

        Ok(tags)
    }

    /// 将任务的标签同步到 CalDAV tags 字符串格式
    pub async fn sync_tags_to_caldav(
        db: &DatabaseConnection,
        task_id: i32,
    ) -> Result<Option<String>> {
        let tags = Self::get_tags_for_task(db, task_id).await?;
        if tags.is_empty() {
            return Ok(None);
        }

        let tag_names: Vec<&str> = tags.iter().map(|t| t.name.as_str()).collect();
        Ok(Some(tag_names.join(", ")))
    }
}
