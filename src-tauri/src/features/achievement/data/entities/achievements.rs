use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// 成就记录
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "achievements")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    /// 成就代码（唯一标识）
    pub code: String,
    /// 解锁时间
    pub unlocked_at: DateTimeUtc,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
