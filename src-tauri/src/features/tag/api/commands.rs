use serde::{Deserialize, Serialize};
use tauri::State;

use crate::core::AppState;
use crate::features::tag::data::{repository::TagRepository, TagModel};

// ========== Request/Response Types ==========

#[derive(Debug, Serialize)]
pub struct TagResponse {
    pub id: i32,
    pub name: String,
    pub color: Option<String>,
}

impl From<TagModel> for TagResponse {
    fn from(model: TagModel) -> Self {
        Self {
            id: model.id,
            name: model.name,
            color: model.color,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateTagPayload {
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTagPayload {
    pub id: i32,
    pub name: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetTaskTagsPayload {
    pub task_id: i32,
    pub tag_ids: Vec<i32>,
}

#[derive(Debug, Deserialize)]
pub struct SetSessionTagsPayload {
    pub session_id: i32,
    pub tag_ids: Vec<i32>,
}

// ========== Tag CRUD Commands ==========

/// 获取所有标签
#[tauri::command]
pub async fn tag_get_all(state: State<'_, AppState>) -> Result<Vec<TagResponse>, String> {
    TagRepository::get_all_tags(state.db())
        .await
        .map(|tags| tags.into_iter().map(TagResponse::from).collect())
        .map_err(|err| err.to_string())
}

/// 创建新标签
#[tauri::command]
pub async fn tag_create(
    state: State<'_, AppState>,
    payload: CreateTagPayload,
) -> Result<TagResponse, String> {
    TagRepository::create_tag(state.db(), &payload.name, payload.color.as_deref())
        .await
        .map(TagResponse::from)
        .map_err(|err| err.to_string())
}

/// 更新标签
#[tauri::command]
pub async fn tag_update(
    state: State<'_, AppState>,
    payload: UpdateTagPayload,
) -> Result<TagResponse, String> {
    TagRepository::update_tag(
        state.db(),
        payload.id,
        payload.name.as_deref(),
        Some(payload.color.as_deref()),
    )
    .await
    .map(TagResponse::from)
    .map_err(|err| err.to_string())
}

/// 删除标签
#[tauri::command]
pub async fn tag_delete(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    TagRepository::delete_tag(state.db(), id)
        .await
        .map_err(|err| err.to_string())
}

// ========== Task Tag Commands ==========

/// 获取任务的所有标签
#[tauri::command]
pub async fn tag_get_for_task(
    state: State<'_, AppState>,
    task_id: i32,
) -> Result<Vec<TagResponse>, String> {
    TagRepository::get_tags_for_task(state.db(), task_id)
        .await
        .map(|tags| tags.into_iter().map(TagResponse::from).collect())
        .map_err(|err| err.to_string())
}

/// 设置任务的标签（替换现有标签）
#[tauri::command]
pub async fn tag_set_for_task(
    state: State<'_, AppState>,
    payload: SetTaskTagsPayload,
) -> Result<(), String> {
    TagRepository::set_tags_for_task(state.db(), payload.task_id, payload.tag_ids)
        .await
        .map_err(|err| err.to_string())
}

// ========== Session Tag Commands ==========

/// 获取番茄钟会话的所有标签
#[tauri::command]
pub async fn tag_get_for_session(
    state: State<'_, AppState>,
    session_id: i32,
) -> Result<Vec<TagResponse>, String> {
    TagRepository::get_tags_for_session(state.db(), session_id)
        .await
        .map(|tags| tags.into_iter().map(TagResponse::from).collect())
        .map_err(|err| err.to_string())
}

/// 设置番茄钟会话的标签（替换现有标签）
#[tauri::command]
pub async fn tag_set_for_session(
    state: State<'_, AppState>,
    payload: SetSessionTagsPayload,
) -> Result<(), String> {
    TagRepository::set_tags_for_session(state.db(), payload.session_id, payload.tag_ids)
        .await
        .map_err(|err| err.to_string())
}
