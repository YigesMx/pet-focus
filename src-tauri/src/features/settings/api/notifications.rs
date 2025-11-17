use crate::infrastructure::notification::{NotificationManager, ToastLevel};

/// 主题设置已更新通知
pub fn notify_theme_updated(notification_manager: &NotificationManager) {
    let _ = notification_manager.send_toast("主题设置已更新".to_string(), ToastLevel::Success);
}

/// 主题设置更新失败通知
pub fn notify_theme_update_failed(notification_manager: &NotificationManager, error: &str) {
    let _ =
        notification_manager.send_toast(format!("更新主题设置失败: {}", error), ToastLevel::Error);
}
