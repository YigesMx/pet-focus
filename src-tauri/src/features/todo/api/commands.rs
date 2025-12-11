use serde::Deserialize;
use tauri::State;

use crate::core::AppState;
use crate::features::todo::core::{models::Todo, service};

#[derive(Debug, Default, Deserialize)]
pub struct CreateTodoPayload {
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTodoPayload {
    pub id: i32,
    pub title: Option<String>,
    pub completed: Option<bool>,
}

#[derive(Debug, Default, Deserialize)]
pub struct UpdateTodoDetailsPayload {
    pub id: i32,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub location: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub start_at: Option<String>,
    pub due_date: Option<String>,
    pub recurrence_rule: Option<String>,
    pub reminder_offset_minutes: Option<i32>,
    pub reminder_method: Option<String>,
    pub timezone: Option<String>,
}

/// 列出所有 todo
#[tauri::command]
pub async fn list_todos(state: State<'_, AppState>) -> Result<Vec<Todo>, String> {
    service::list_todos(state.db())
        .await
        .map_err(|err| err.to_string())
}

/// 创建新 todo
#[tauri::command]
pub async fn create_todo(
    state: State<'_, AppState>,
    payload: Option<CreateTodoPayload>,
) -> Result<Todo, String> {
    let title = payload.and_then(|payload| payload.title);

    let result = service::create_todo(state.db(), title)
        .await
        .map_err(|err| err.to_string())?;

    // TODO: 发送 todo 变更通知
    // state.notify_todo_change("created", Some(result.id)).await;

    // 触发调度器重新规划提醒
    if let Some(scheduler) = state.todo_scheduler() {
        scheduler.reschedule().await;
    }

    Ok(result)
}

/// 更新 todo
#[tauri::command]
pub async fn update_todo(
    state: State<'_, AppState>,
    payload: UpdateTodoPayload,
) -> Result<Todo, String> {
    let result = service::update_todo(state.db(), payload.id, payload.title, payload.completed)
        .await
        .map_err(|err| err.to_string())?;

    // TODO: 发送 todo 变更通知
    // state.notify_todo_change("updated", Some(payload.id)).await;

    // 触发调度器重新规划提醒
    if let Some(scheduler) = state.todo_scheduler() {
        scheduler.reschedule().await;
    }

    Ok(result)
}

/// 删除 todo
#[tauri::command]
pub async fn delete_todo(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    service::delete_todo(state.db(), id)
        .await
        .map_err(|err| err.to_string())?;

    // TODO: 发送 todo 变更通知
    // state.notify_todo_change("deleted", Some(id)).await;

    // 触发调度器重新规划提醒
    if let Some(scheduler) = state.todo_scheduler() {
        scheduler.reschedule().await;
    }

    Ok(())
}

/// 更新 todo 详细信息
#[tauri::command]
pub async fn update_todo_details(
    state: State<'_, AppState>,
    payload: UpdateTodoDetailsPayload,
) -> Result<Todo, String> {
    let result = service::update_todo_details(
        state.db(),
        payload.id,
        payload.description,
        payload.priority,
        payload.location,
        payload.tags,
        payload.start_at,
        payload.due_date,
        payload.recurrence_rule,
        payload.reminder_offset_minutes,
        payload.reminder_method,
        payload.timezone,
    )
    .await
    .map_err(|err| err.to_string())?;

    // TODO: 发送 todo 变更通知
    // state.notify_todo_change("updated", Some(payload.id)).await;

    // 触发调度器重新规划提醒（因为可能修改了提醒相关字段）
    if let Some(scheduler) = state.todo_scheduler() {
        scheduler.reschedule().await;
    }

    Ok(result)
}

/// 获取指定任务的所有子任务
#[tauri::command]
pub async fn get_subtasks(state: State<'_, AppState>, parent_id: i32) -> Result<Vec<Todo>, String> {
    service::get_subtasks(state.db(), parent_id)
        .await
        .map_err(|err| err.to_string())
}

/// 更新任务的父任务关系
#[tauri::command]
pub async fn update_todo_parent(
    state: State<'_, AppState>,
    id: i32,
    parent_id: Option<i32>,
) -> Result<Todo, String> {
    service::update_parent(state.db(), id, parent_id)
        .await
        .map_err(|err| err.to_string())
}

/// 重新排序任务
#[tauri::command]
pub async fn reorder_todo(
    state: State<'_, AppState>,
    id: i32,
    before_id: Option<i32>,
    after_id: Option<i32>,
    new_parent_id: Option<i32>,
) -> Result<Todo, String> {
    service::reorder_todo(state.db(), id, before_id, after_id, new_parent_id)
        .await
        .map_err(|err| err.to_string())
}
