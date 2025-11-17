use crate::infrastructure::notification::{NotificationManager, ToastLevel};

/// WebServer 启动通知
pub fn notify_server_started(notification_manager: &NotificationManager, port: u16) {
    let _ = notification_manager.send_toast(
        format!("外部 API 已启动：http://127.0.0.1:{}", port),
        ToastLevel::Success,
    );
}

/// WebServer 停止通知
pub fn notify_server_stopped(notification_manager: &NotificationManager) {
    let _ = notification_manager.send_toast("已停止外部 API".to_string(), ToastLevel::Success);
}

/// WebServer 启动失败通知
pub fn notify_server_start_failed(notification_manager: &NotificationManager, error: &str) {
    let _ = notification_manager
        .send_toast(format!("API 服务器启动失败: {}", error), ToastLevel::Error);
}

/// WebServer 停止失败通知
pub fn notify_server_stop_failed(notification_manager: &NotificationManager, error: &str) {
    let _ = notification_manager
        .send_toast(format!("API 服务器停止失败: {}", error), ToastLevel::Error);
}
