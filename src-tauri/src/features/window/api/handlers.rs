use serde_json::json;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::features::window::manager;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::infrastructure::webserver::HandlerRegistry;

/// 注册 Window Feature 的所有 WebSocket handlers
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn register_handlers(registry: &mut HandlerRegistry) {
    // 显示主窗口
    registry.register_call("window.show", |_method, _params, ctx| {
        Box::pin(async move {
            manager::show_main_window(ctx.app_handle())
                .map_err(|e| anyhow::anyhow!("Failed to show window: {}", e))?;
            Ok(json!({"success": true}))
        })
    });

    // 隐藏主窗口
    registry.register_call("window.hide", |_method, _params, ctx| {
        Box::pin(async move {
            manager::hide_main_window(ctx.app_handle())
                .map_err(|e| anyhow::anyhow!("Failed to hide window: {}", e))?;
            Ok(json!({"success": true}))
        })
    });

    // 切换主窗口显示/隐藏
    registry.register_call("window.toggle", |_method, _params, ctx| {
        Box::pin(async move {
            manager::toggle_main_window(ctx.app_handle())
                .map_err(|e| anyhow::anyhow!("Failed to toggle window: {}", e))?;
            Ok(json!({"success": true}))
        })
    });
}
