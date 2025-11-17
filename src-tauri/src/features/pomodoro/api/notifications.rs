use crate::infrastructure::notification::{NotificationManager, ToastLevel};

pub fn notify_focus_started(notification_manager: &NotificationManager) {
    let _ = notification_manager.send_toast("开始专注".to_string(), ToastLevel::Info);
    let _ = notification_manager.send_native("开始专注".to_string(), "进入专注阶段".to_string());
}

pub fn notify_break_started(notification_manager: &NotificationManager, long: bool) {
    let title = if long { "长休开始" } else { "短休开始" };
    let _ = notification_manager.send_toast(title.to_string(), ToastLevel::Info);
    let _ = notification_manager.send_native(title.to_string(), "放松一下".to_string());
}
