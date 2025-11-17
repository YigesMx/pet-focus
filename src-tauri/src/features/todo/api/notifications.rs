use serde_json::json;

use crate::infrastructure::notification::{NotificationManager, ToastLevel};

/// Todo Feature 的所有通知定义
///
/// 统一管理 Todo 相关的用户通知（Toast + WebSocket）
///
/// 所有通知都通过 NotificationManager 统一发送，确保：
/// - Toast 通知：前端用户看到 Sonner 提示
/// - WebSocket 通知：外部 API 客户端收到事件推送

/// WebSocket Event 名称
pub const TODO_CHANGES_EVENT: &str = "todo.changes";
pub const TODO_DUE_EVENT: &str = "todo.due";

/// 创建 Todo 成功通知（Toast + WebSocket）
pub fn notify_todo_created(notification_manager: &NotificationManager, todo_id: i32, title: &str) {
    let _ = notification_manager.notify(
        format!("待办 \"{}\" 创建成功", title),
        ToastLevel::Success,
        TODO_CHANGES_EVENT.to_string(),
        json!({
            "action": "created",
            "todo_id": todo_id,
        }),
    );
}

/// 更新 Todo 成功通知（Toast + WebSocket）
pub fn notify_todo_updated(notification_manager: &NotificationManager, todo_id: i32, title: &str) {
    let _ = notification_manager.notify(
        format!("待办 \"{}\" 更新成功", title),
        ToastLevel::Success,
        TODO_CHANGES_EVENT.to_string(),
        json!({
            "action": "updated",
            "todo_id": todo_id,
        }),
    );
}

/// 删除 Todo 成功通知（Toast + WebSocket）
pub fn notify_todo_deleted(notification_manager: &NotificationManager, todo_id: i32) {
    let _ = notification_manager.notify(
        "待办删除成功".to_string(),
        ToastLevel::Success,
        TODO_CHANGES_EVENT.to_string(),
        json!({
            "action": "deleted",
            "todo_id": todo_id,
        }),
    );
}

/// Todo 到期提醒通知（Toast + WebSocket）
pub fn notify_todo_due(notification_manager: &NotificationManager, todo_id: i32, title: &str) {
    let _ = notification_manager.notify(
        format!("⏰ 待办 \"{}\" 已到期", title),
        ToastLevel::Warning,
        TODO_DUE_EVENT.to_string(),
        json!({
            "todo_id": todo_id,
            "title": title,
        }),
    );

    // 系统通知（原生通知中心）
    let _ = notification_manager.send_native("待办到期".to_string(), format!("{} 已到期", title));
}

/// CalDAV 同步成功通知
pub fn notify_sync_success(
    notification_manager: &NotificationManager,
    created: usize,
    updated: usize,
    pushed: usize,
    deleted: usize,
) {
    if created + updated + pushed + deleted > 0 {
        let _ = notification_manager.send_toast(
            format!(
                "同步完成：新建 {}，更新 {}，推送 {}，删除 {}",
                created, updated, pushed, deleted
            ),
            ToastLevel::Success,
        );
    }
}

/// CalDAV 同步失败通知
pub fn notify_sync_error(notification_manager: &NotificationManager, error: &str) {
    let _ = notification_manager.send_toast(format!("同步失败：{}", error), ToastLevel::Error);
}

/// CalDAV 配置保存成功通知
pub fn notify_caldav_config_saved(notification_manager: &NotificationManager) {
    let _ = notification_manager.send_toast("CalDAV 配置已保存".to_string(), ToastLevel::Success);
}

/// CalDAV 配置清除成功通知
pub fn notify_caldav_config_cleared(notification_manager: &NotificationManager) {
    let _ = notification_manager.send_toast("已清除 CalDAV 配置".to_string(), ToastLevel::Success);
}
