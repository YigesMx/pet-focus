use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// 用户统计数据（包含金币）
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "user_stats")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    /// 当前金币数量
    pub coins: i64,
    /// 累计获得的金币总数
    pub total_coins_earned: i64,
    /// 累计花费的金币总数
    pub total_coins_spent: i64,
    /// 累计专注时长（秒）
    pub total_focus_seconds: i64,
    /// 累计完成的专注次数
    pub total_focus_count: i32,
    /// 连续专注天数
    pub streak_days: i32,
    /// 最长连续专注天数
    pub max_streak_days: i32,
    /// 最后一次专注日期（用于计算连续天数）
    pub last_focus_date: Option<String>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
