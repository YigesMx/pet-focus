use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// 专注会话组
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "pomodoro_sessions")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    /// 备注（用户可编辑）
    pub note: Option<String>,
    /// 是否已存档
    pub archived: bool,
    /// 存档时间
    pub archived_at: Option<DateTimeUtc>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::pomodoro_records::Entity")]
    Records,
}

impl Related<super::pomodoro_records::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Records.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
