use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Session 与 Todo 的多对多关联表
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "session_todo_links")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    /// 关联的 Session ID
    pub session_id: i32,
    /// 关联的 Todo ID
    pub todo_id: i32,
    /// 排序顺序
    pub sort_order: i32,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::pomodoro_sessions::Entity",
        from = "Column::SessionId",
        to = "super::pomodoro_sessions::Column::Id",
        on_delete = "Cascade"
    )]
    Session,
}

impl Related<super::pomodoro_sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Session.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
