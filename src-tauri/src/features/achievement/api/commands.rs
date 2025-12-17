use serde::Deserialize;
use tauri::{command, State};

use crate::core::AppState;
use crate::features::achievement::core::{models::UserStats, service};

/// 获取用户统计数据
#[command]
pub async fn achievement_get_stats(state: State<'_, AppState>) -> Result<UserStats, String> {
    service::get_user_stats(state.db())
        .await
        .map_err(|e| e.to_string())
}

/// 获取当前金币数量
#[command]
pub async fn achievement_get_coins(state: State<'_, AppState>) -> Result<i64, String> {
    service::get_coins(state.db())
        .await
        .map_err(|e| e.to_string())
}

/// 获取所有成就列表（包含解锁状态）
#[command]
pub async fn achievement_list(
    state: State<'_, AppState>,
) -> Result<Vec<crate::features::achievement::core::models::AchievementInfo>, String> {
    service::list_achievements(state.db())
        .await
        .map_err(|e| e.to_string())
}

/// 获取金币交易记录
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListTransactionsParams {
    pub limit: Option<u64>,
}

#[command]
pub async fn achievement_list_transactions(
    state: State<'_, AppState>,
    params: Option<ListTransactionsParams>,
) -> Result<Vec<crate::features::achievement::data::entities::coin_transactions::Model>, String> {
    let limit = params.and_then(|p| p.limit).unwrap_or(50);
    service::list_coin_transactions(state.db(), limit)
        .await
        .map_err(|e| e.to_string())
}

/// 检查并领取每日启动奖励
/// 返回奖励事件，如果今天已领取则返回 null
#[command]
pub async fn achievement_claim_daily_reward(
    state: State<'_, AppState>,
) -> Result<Option<crate::features::achievement::core::models::CoinsChangedEvent>, String> {
    service::check_and_claim_daily_reward(state.db())
        .await
        .map_err(|e| e.to_string())
}
