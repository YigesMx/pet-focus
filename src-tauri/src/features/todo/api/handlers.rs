use anyhow::Context;
use serde_json::{json, Value};
use tauri::Manager;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::infrastructure::webserver;

use super::notifications;
use crate::features::todo::core::service;

/// 注册 Todo Feature 的所有 WebSocket handlers
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn register_handlers(registry: &mut webserver::HandlerRegistry) {
    // 注册可订阅的事件
    registry.register_event(
        notifications::TODO_DUE_EVENT,
        "Todo 到期提醒事件 - 当待办事项到期时广播",
    );
    registry.register_event(
        notifications::TODO_CHANGES_EVENT,
        "Todo 数据变更事件 - 创建/更新/删除时广播",
    );

    // 列出所有待办
    registry.register_call("todo.list", |_method, _params, ctx| {
        Box::pin(async move {
            let todos = service::list_todos(ctx.db())
                .await
                .context("Failed to list todos")?;
            Ok(json!(todos))
        })
    });

    // 获取单个待办
    registry.register_call("todo.get", |_method, params, ctx| {
        Box::pin(async move {
            let id = params
                .get("id")
                .and_then(|v| v.as_i64())
                .context("Missing or invalid id")? as i32;

            let todo = service::get_todo(ctx.db(), id)
                .await
                .context("Failed to get todo")?;

            Ok(json!(todo))
        })
    });

    // 创建待办
    registry.register_call("todo.create", |_method, params, ctx| {
        Box::pin(async move {
            let title = params
                .get("title")
                .and_then(|v| v.as_str())
                .map(String::from);

            let todo = service::create_todo(ctx.db(), title)
                .await
                .context("Failed to create todo")?;

            // 同时通过 Tauri Event 通知前端（给内置前端）
            use tauri::Emitter;
            let _ = ctx.app_handle().emit(
                "todo-data-updated",
                json!({
                    "action": "created",
                    "todoId": todo.id,
                    "source": "webserver"
                }),
            );

            // 发送 Toast + WebSocket 通知 & 触发调度器重新规划
            if let Some(state) = ctx.app_handle().try_state::<crate::core::AppState>() {
                notifications::notify_todo_created(state.notification(), todo.id, &todo.title);

                // 触发调度器重新规划提醒
                if let Some(scheduler) = state.todo_scheduler() {
                    scheduler.reschedule().await;
                }
            }

            Ok(json!(todo))
        })
    });

    // 更新待办
    registry.register_call("todo.update", |_method, params, ctx| {
        Box::pin(async move {
            let id = params
                .get("id")
                .and_then(|v| v.as_i64())
                .context("Missing or invalid id")? as i32;

            let title = params
                .get("title")
                .and_then(|v| v.as_str())
                .map(String::from);
            let completed = params.get("completed").and_then(|v| v.as_bool());

            let todo = service::update_todo(ctx.db(), id, title, completed)
                .await
                .context("Failed to update todo")?;

            // 同时通过 Tauri Event 通知前端（给内置前端）
            use tauri::Emitter;
            let _ = ctx.app_handle().emit(
                "todo-data-updated",
                json!({
                    "action": "updated",
                    "todoId": id,
                    "source": "webserver"
                }),
            );

            // 发送 Toast + WebSocket 通知 & 触发调度器重新规划
            if let Some(state) = ctx.app_handle().try_state::<crate::core::AppState>() {
                notifications::notify_todo_updated(state.notification(), id, &todo.title);

                // 触发调度器重新规划提醒
                if let Some(scheduler) = state.todo_scheduler() {
                    scheduler.reschedule().await;
                }
            }

            Ok(json!(todo))
        })
    });

    // 删除待办
    registry.register_call("todo.delete", |_method, params, ctx| {
        Box::pin(async move {
            let id = params
                .get("id")
                .and_then(|v| v.as_i64())
                .context("Missing or invalid id")? as i32;

            service::delete_todo(ctx.db(), id)
                .await
                .context("Failed to delete todo")?;

            // 同时通过 Tauri Event 通知前端（给内置前端）
            use tauri::Emitter;
            let _ = ctx.app_handle().emit(
                "todo-data-updated",
                json!({
                    "action": "deleted",
                    "todoId": id,
                    "source": "webserver"
                }),
            );

            // 发送 Toast + WebSocket 通知 & 触发调度器重新规划
            if let Some(state) = ctx.app_handle().try_state::<crate::core::AppState>() {
                notifications::notify_todo_deleted(state.notification(), id);

                // 触发调度器重新规划提醒
                if let Some(scheduler) = state.todo_scheduler() {
                    scheduler.reschedule().await;
                }
            }

            Ok(json!({"success": true}))
        })
    });

    // 更新待办详情
    registry.register_call("todo.update_details", |_method, params, ctx| {
        Box::pin(async move {
            let id = params
                .get("id")
                .and_then(|v| v.as_i64())
                .context("Missing or invalid id")? as i32;

            let description = params
                .get("description")
                .and_then(|v| v.as_str())
                .map(String::from);

            let priority = params
                .get("priority")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32);

            let location = params
                .get("location")
                .and_then(|v| v.as_str())
                .map(String::from);

            let tags = match params.get("tags") {
                Some(Value::Array(items)) => items
                    .iter()
                    .filter_map(|value| value.as_str().map(|s| s.to_string()))
                    .collect(),
                Some(Value::String(text)) => text
                    .split(',')
                    .map(|item| item.trim())
                    .filter(|item| !item.is_empty())
                    .map(|item| item.to_string())
                    .collect(),
                Some(Value::Null) | None => Vec::new(),
                _ => anyhow::bail!("Invalid tags format"),
            };

            let start_at = params
                .get("start_at")
                .and_then(|v| v.as_str())
                .map(String::from);

            let due_date = match params.get("due_date") {
                Some(Value::String(text)) => Some(text.clone()),
                Some(Value::Null) | None => None,
                _ => anyhow::bail!("Invalid due_date format"),
            };

            let recurrence_rule = params
                .get("recurrence_rule")
                .and_then(|v| v.as_str())
                .map(String::from);

            let reminder_offset_minutes = params
                .get("reminder_offset_minutes")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32);

            let reminder_method = params
                .get("reminder_method")
                .and_then(|v| v.as_str())
                .map(String::from);

            let timezone = params
                .get("timezone")
                .and_then(|v| v.as_str())
                .map(String::from);

            let todo = service::update_todo_details(
                ctx.db(),
                id,
                description,
                priority,
                location,
                tags,
                start_at,
                due_date,
                recurrence_rule,
                reminder_offset_minutes,
                reminder_method,
                timezone,
            )
            .await
            .context("Failed to update todo details")?;

            // 同时通过 Tauri Event 通知前端（给内置前端）
            use tauri::Emitter;
            let _ = ctx.app_handle().emit(
                "todo-data-updated",
                json!({
                    "action": "updated",
                    "todoId": id,
                    "source": "webserver"
                }),
            );

            // 发送 Toast + WebSocket 通知 & 触发调度器重新规划
            if let Some(state) = ctx.app_handle().try_state::<crate::core::AppState>() {
                notifications::notify_todo_updated(state.notification(), id, &todo.title);

                // 触发调度器重新规划提醒（因为可能修改了提醒相关字段）
                if let Some(scheduler) = state.todo_scheduler() {
                    scheduler.reschedule().await;
                }
            }

            Ok(json!(todo))
        })
    });
}
