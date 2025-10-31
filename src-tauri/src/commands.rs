use serde::Deserialize;
use tauri::State;

use crate::{
    models::todo::Todo,
    services::todo_service,
    AppState,
};

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

#[tauri::command]
pub async fn list_todos(state: State<'_, AppState>) -> Result<Vec<Todo>, String> {
    todo_service::list_todos(state.db())
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn create_todo(
    state: State<'_, AppState>,
    payload: Option<CreateTodoPayload>,
) -> Result<Todo, String> {
    let title = payload.and_then(|payload| payload.title);

    todo_service::create_todo(state.db(), title)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn update_todo(
    state: State<'_, AppState>,
    payload: UpdateTodoPayload,
) -> Result<Todo, String> {
    todo_service::update_todo(state.db(), payload.id, payload.title, payload.completed)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn delete_todo(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    todo_service::delete_todo(state.db(), id)
        .await
        .map_err(|err| err.to_string())
}
