use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Tag 标签实体
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tags")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    /// 标签名称，唯一
    #[sea_orm(unique)]
    pub name: String,
    /// 标签颜色（可选，hex 格式如 #FF5733）
    pub color: Option<String>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::task_tag_entity::Entity")]
    TaskTags,
    #[sea_orm(has_many = "super::session_tag_entity::Entity")]
    SessionTags,
}

impl Related<super::task_tag_entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TaskTags.def()
    }
}

impl Related<super::session_tag_entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SessionTags.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
