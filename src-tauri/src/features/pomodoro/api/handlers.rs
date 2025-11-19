use anyhow::Context;
use serde_json::json;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::infrastructure::webserver;

use crate::features::pomodoro::core::service;

use crate::features::pomodoro::PomodoroFeature;

/// 注册 Pomodoro 的 WebSocket handlers
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn register_handlers(feature: &PomodoroFeature, registry: &mut webserver::HandlerRegistry) {
    // 注册事件频道
    registry.register_event("pomodoro.status", "番茄钟状态变更事件");
    registry.register_event("pomodoro.tick", "番茄钟每秒心跳事件");
    registry.register_event("pomodoro.events", "番茄钟生命周期事件(start/finish/stop/skip)");

    // Start
    registry.register_call("pomodoro.start", move |_method, _params, ctx| {
        Box::pin(async move {
            let cfg = service::get_config(ctx.db())
                .await
                .context("Failed to read config")?;
            let mgr = get_manager(&ctx).context("Pomodoro manager not found")?;
            let status = mgr.start(cfg).await.context("Failed to start")?;
            Ok(serde_json::to_value(status).unwrap_or(json!({})))
        })
    });

    // Pause
    registry.register_call("pomodoro.pause", |_method, _params, ctx| {
        Box::pin(async move {
            let mgr = get_manager(&ctx).context("Pomodoro manager not found")?;
            let status = mgr.pause().await;
            Ok(serde_json::to_value(status).unwrap_or(json!({})))
        })
    });

    // Resume
    registry.register_call("pomodoro.resume", |_method, _params, ctx| {
        Box::pin(async move {
            let mgr = get_manager(&ctx).context("Pomodoro manager not found")?;
            let status = mgr.resume().await;
            Ok(serde_json::to_value(status).unwrap_or(json!({})))
        })
    });

    // Skip
    registry.register_call("pomodoro.skip", |_method, _params, ctx| {
        Box::pin(async move {
            let cfg = service::get_config(ctx.db())
                .await
                .context("Failed to read config")?;
            let mgr = get_manager(&ctx).context("Pomodoro manager not found")?;
            let status = mgr.skip(cfg).await;
            Ok(serde_json::to_value(status).unwrap_or(json!({})))
        })
    });

    // Stop
    registry.register_call("pomodoro.stop", |_method, _params, ctx| {
        Box::pin(async move {
            let mgr = get_manager(&ctx).context("Pomodoro manager not found")?;
            let status = mgr.stop().await;
            Ok(serde_json::to_value(status).unwrap_or(json!({})))
        })
    });

    // Status
    registry.register_call("pomodoro.status", |_method, _params, ctx| {
        Box::pin(async move {
            let mgr = get_manager(&ctx).context("Pomodoro manager not found")?;
            let status = mgr.status().await;
            Ok(serde_json::to_value(status).unwrap_or(json!({})))
        })
    });
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn get_manager(
    ctx: &crate::infrastructure::webserver::core::ws::ApiContext,
) -> Option<std::sync::Arc<crate::features::pomodoro::core::scheduler::PomodoroManager>> {
    use tauri::Manager;
    let state = ctx.app_handle().try_state::<crate::core::AppState>()?;
    let feature = state.get_feature("pomodoro")?;
    let feature = feature
        .as_any()
        .downcast_ref::<crate::features::pomodoro::PomodoroFeature>()?;
    feature.manager().cloned()
}
