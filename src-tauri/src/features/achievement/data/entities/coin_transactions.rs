use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// 金币交易记录
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "coin_transactions")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    /// 交易金额（正数为获得，负数为花费）
    pub amount: i64,
    /// 交易类型：focus_complete（专注完成）, achievement（成就奖励）, spend（消费）, bonus（其他奖励）
    pub transaction_type: String,
    /// 交易描述
    pub description: String,
    /// 关联的专注记录ID（可选）
    pub related_record_id: Option<i32>,
    /// 关联的成就代码（可选）
    pub related_achievement_code: Option<String>,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
