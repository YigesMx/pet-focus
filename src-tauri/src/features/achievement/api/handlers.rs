use anyhow::Context;

use crate::features::achievement::AchievementFeature;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::infrastructure::webserver::HandlerRegistry;

/// WebSocket 事件频道名称
pub const WS_EVENT_COINS_CHANGED: &str = "achievement.coins_changed";
pub const WS_EVENT_ACHIEVEMENT_UNLOCKED: &str = "achievement.unlocked";
pub const WS_EVENT_STATS_UPDATED: &str = "achievement.stats_updated";

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn register_handlers(_feature: &AchievementFeature, registry: &mut HandlerRegistry) {
    // 注册事件频道（用于订阅）
    registry.register_event(WS_EVENT_COINS_CHANGED, "金币变化事件");
    registry.register_event(WS_EVENT_ACHIEVEMENT_UNLOCKED, "成就解锁事件");
    registry.register_event(WS_EVENT_STATS_UPDATED, "统计数据更新事件");

    // 注册查询接口
    registry.register_call("achievement.get_stats", |_method, _params, ctx| {
        Box::pin(async move {
            use crate::features::achievement::core::service;

            let stats = service::get_user_stats(ctx.db())
                .await
                .context("Failed to get user stats")?;

            Ok(serde_json::to_value(stats).unwrap_or_default())
        })
    });

    registry.register_call("achievement.get_coins", |_method, _params, ctx| {
        Box::pin(async move {
            use crate::features::achievement::core::service;

            let coins = service::get_coins(ctx.db())
                .await
                .context("Failed to get coins")?;

            Ok(serde_json::json!({ "coins": coins }))
        })
    });

    registry.register_call("achievement.list", |_method, _params, ctx| {
        Box::pin(async move {
            use crate::features::achievement::core::service;

            let achievements = service::list_achievements(ctx.db())
                .await
                .context("Failed to list achievements")?;

            Ok(serde_json::to_value(achievements).unwrap_or_default())
        })
    });
}
