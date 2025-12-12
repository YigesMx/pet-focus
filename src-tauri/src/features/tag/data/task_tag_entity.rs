use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Task-Tag 多对多关联表
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "task_tags")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub task_id: i32,
    #[sea_orm(primary_key, auto_increment = false)]
    pub tag_id: i32,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "crate::features::todo::data::entity::Entity",
        from = "Column::TaskId",
        to = "crate::features::todo::data::entity::Column::Id",
        on_delete = "Cascade"
    )]
    Task,
    #[sea_orm(
        belongs_to = "super::entity::Entity",
        from = "Column::TagId",
        to = "super::entity::Column::Id",
        on_delete = "Cascade"
    )]
    Tag,
}

impl Related<crate::features::todo::data::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Task.def()
    }
}

impl Related<super::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tag.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
