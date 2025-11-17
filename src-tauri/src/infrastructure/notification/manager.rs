use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

/// 通知管理器
///
/// **专门用于向用户发送通知，而不是内部逻辑通信**
///
/// # 设计原则
///
/// - **Toast**: 前端弹出 Sonner Toast（通过 Tauri Event 发送给 NotificationCenter）
/// - **WebSocket**: 外部客户端弹出通知（通过 WebServer 的 WebSocket 广播）
/// - **Native**: 系统原生通知（TODO）
///
/// # 注意
///
/// 如果只是后端通知前端更新视图或同步状态，**不要使用 NotificationManager**！
/// 直接使用 `app_handle.emit()` 发送 Tauri Event。
#[derive(Clone)]
pub struct NotificationManager {
    app_handle: AppHandle,
}

impl NotificationManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// 发送 WebSocket 事件通知
    ///
    /// 用于通过 WebSocket 向外部 API 客户端广播事件
    ///
    /// 注意：
    /// - 如果 WebServer 未启动，此方法会静默失败（不会抛出错误）
    /// - 这是合理的设计，因为外部客户端连接是可选的
    fn send_websocket_internal(&self, channel: String, payload: serde_json::Value) {
        let app_handle = self.app_handle.clone();

        // 尝试获取 AppState 中的 WebServer ConnectionManager
        if let Some(state) = app_handle.try_state::<crate::core::AppState>() {
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            if let Some(webserver) = state.webserver_manager().get_connection_manager() {
                // 通过 WebServer 的 ConnectionManager 广播
                let message =
                    crate::infrastructure::webserver::WsMessage::event(channel.clone(), payload);

                tauri::async_runtime::spawn(async move {
                    webserver.broadcast_to_channel(&channel, message).await;
                });
            }
        }
    }

    /// 发送 Toast 通知（由前端 NotificationCenter 处理）
    ///
    /// 使用 Tauri Event 发送给前端，前端 NotificationCenter 监听并显示 Sonner Toast
    pub fn send_toast(&self, message: String, level: ToastLevel) -> anyhow::Result<()> {
        self.app_handle
            .emit(
                "toast-notification",
                serde_json::json!({
                    "message": message,
                    "level": level.as_str(),
                }),
            )
            .map_err(|e| anyhow::anyhow!("Failed to emit toast notification: {}", e))
    }

    /// 发送 Native 系统通知（预留）
    pub fn send_native(&self, title: String, body: String) -> anyhow::Result<()> {
        // 使用 tauri-plugin-notification 发送系统通知
        // 桌面与移动平台若插件可用则正常通知；若不可用则静默返回 Ok(())
        let notifier = self.app_handle.notification();
        notifier
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|e| anyhow::anyhow!("Failed to show native notification: {}", e))?;

        Ok(())
    }

    /// 同时发送 Toast 和 WebSocket 通知
    ///
    /// 这是推荐的通知方式：
    /// - Toast: 前端用户看到 Sonner 提示
    /// - WebSocket: 外部 API 客户端收到事件推送（如果 WebServer 正在运行）
    pub fn notify(
        &self,
        toast_message: String,
        toast_level: ToastLevel,
        ws_channel: String,
        ws_payload: serde_json::Value,
    ) -> anyhow::Result<()> {
        // 发送 Toast
        self.send_toast(toast_message, toast_level)?;

        // 发送 WebSocket（静默失败，不影响主流程）
        self.send_websocket_internal(ws_channel, ws_payload);

        Ok(())
    }

    /// 仅发送 WebSocket 事件通知（不显示 Toast）
    ///
    /// 用于纯数据变更通知，不需要用户界面提示的场景
    ///
    /// 注意：如果 WebServer 未启动，此方法会静默失败
    pub fn send_websocket_event(&self, channel: String, payload: serde_json::Value) {
        self.send_websocket_internal(channel, payload);
    }
}

/// Toast 级别
#[derive(Debug, Clone, Copy)]
pub enum ToastLevel {
    Info,
    Success,
    Warning,
    Error,
}

impl ToastLevel {
    pub(crate) fn as_str(&self) -> &'static str {
        match self {
            ToastLevel::Info => "info",
            ToastLevel::Success => "success",
            ToastLevel::Warning => "warning",
            ToastLevel::Error => "error",
        }
    }
}
