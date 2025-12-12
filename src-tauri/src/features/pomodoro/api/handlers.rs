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
    registry.register_event(
        "pomodoro.events",
        "番茄钟生命周期事件(start/finish/stop/skip)",
    );

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

    // ==================== Session-Todo Links ====================

    // List session todo links
    registry.register_call("session_todo_link.list", |_method, params, ctx| {
        Box::pin(async move {
            let session_id = params
                .get("sessionId")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
                .context("Missing sessionId")?;

            let links = service::list_session_todo_links(ctx.db(), session_id)
                .await
                .context("Failed to list session todo links")?;

            Ok(serde_json::to_value(links).unwrap_or(json!([])))
        })
    });

    // Add session todo link
    registry.register_call("session_todo_link.add", |_method, params, ctx| {
        Box::pin(async move {
            let session_id = params
                .get("sessionId")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
                .context("Missing sessionId")?;
            let todo_id = params
                .get("todoId")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
                .context("Missing todoId")?;

            let link = service::add_session_todo_link(ctx.db(), session_id, todo_id)
                .await
                .context("Failed to add session todo link")?;

            Ok(serde_json::to_value(link).unwrap_or(json!({})))
        })
    });

    // Remove session todo link
    registry.register_call("session_todo_link.remove", |_method, params, ctx| {
        Box::pin(async move {
            let session_id = params
                .get("sessionId")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
                .context("Missing sessionId")?;
            let todo_id = params
                .get("todoId")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
                .context("Missing todoId")?;

            service::remove_session_todo_link(ctx.db(), session_id, todo_id)
                .await
                .context("Failed to remove session todo link")?;

            Ok(json!({ "success": true }))
        })
    });

    // Reorder session todo links
    registry.register_call("session_todo_link.reorder", |_method, params, ctx| {
        Box::pin(async move {
            let session_id = params
                .get("sessionId")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
                .context("Missing sessionId")?;
            let todo_ids: Vec<i32> = params
                .get("todoIds")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_i64().map(|n| n as i32))
                        .collect()
                })
                .unwrap_or_default();

            service::reorder_session_todo_links(ctx.db(), session_id, todo_ids)
                .await
                .context("Failed to reorder session todo links")?;

            Ok(json!({ "success": true }))
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
