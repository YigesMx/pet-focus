use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Session-Tag 多对多关联表
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "session_tags")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub session_id: i32,
    #[sea_orm(primary_key, auto_increment = false)]
    pub tag_id: i32,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "crate::features::pomodoro::data::entity::Entity",
        from = "Column::SessionId",
        to = "crate::features::pomodoro::data::entity::Column::Id",
        on_delete = "Cascade"
    )]
    Session,
    #[sea_orm(
        belongs_to = "super::entity::Entity",
        from = "Column::TagId",
        to = "super::entity::Column::Id",
        on_delete = "Cascade"
    )]
    Tag,
}

impl Related<crate::features::pomodoro::data::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Session.def()
    }
}

impl Related<super::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tag.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
