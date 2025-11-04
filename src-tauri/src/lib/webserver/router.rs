use anyhow::Error;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use super::super::{models::todo::Todo, services::todo_service};

use super::context::ApiContext;

pub(super) fn build_router(state: ApiContext) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/todos", get(list_todos).post(create_todo))
        .route(
            "/todos/{id}",
            get(get_todo).patch(update_todo).delete(delete_todo),
        )
        .with_state(state)
}

#[derive(Debug, Deserialize)]
struct CreateTodoRequest {
    title: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateTodoRequest {
    title: Option<String>,
    completed: Option<bool>,
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    message: String,
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    fn from_service_error(err: Error) -> Self {
        let message = err.to_string();
        if message.to_ascii_lowercase().contains("not found") {
            Self::new(StatusCode::NOT_FOUND, message)
        } else {
            eprintln!("web server internal error: {message}");
            Self::new(StatusCode::INTERNAL_SERVER_ERROR, "internal server error")
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status;
        let body = Json(ErrorBody { message: self.message });
        (status, body).into_response()
    }
}

async fn health() -> impl IntoResponse {
    #[derive(Serialize)]
    struct HealthResponse {
        status: &'static str,
    }

    (StatusCode::OK, Json(HealthResponse { status: "ok" }))
}

async fn list_todos(State(ctx): State<ApiContext>) -> Result<Json<Vec<Todo>>, ApiError> {
    todo_service::list_todos(ctx.db())
        .await
        .map(Json)
        .map_err(ApiError::from_service_error)
}

async fn create_todo(
    State(ctx): State<ApiContext>,
    Json(payload): Json<CreateTodoRequest>,
) -> Result<(StatusCode, Json<Todo>), ApiError> {
    todo_service::create_todo(ctx.db(), payload.title)
        .await
        .map(|todo| {
            let todo_id = todo.id;
            ctx.notify_change("created", Some(todo_id));
            (StatusCode::CREATED, Json(todo))
        })
        .map_err(ApiError::from_service_error)
}

async fn get_todo(
    Path(id): Path<i32>,
    State(ctx): State<ApiContext>,
) -> Result<Json<Todo>, ApiError> {
    todo_service::get_todo(ctx.db(), id)
        .await
        .map(Json)
        .map_err(ApiError::from_service_error)
}

async fn update_todo(
    Path(id): Path<i32>,
    State(ctx): State<ApiContext>,
    Json(payload): Json<UpdateTodoRequest>,
) -> Result<Json<Todo>, ApiError> {
    todo_service::update_todo(ctx.db(), id, payload.title, payload.completed)
        .await
        .map(|todo| {
            ctx.notify_change("updated", Some(id));
            Json(todo)
        })
        .map_err(ApiError::from_service_error)
}

async fn delete_todo(
    Path(id): Path<i32>,
    State(ctx): State<ApiContext>,
) -> Result<StatusCode, ApiError> {
    todo_service::delete_todo(ctx.db(), id)
        .await
        .map(|_| {
            ctx.notify_change("deleted", Some(id));
            StatusCode::NO_CONTENT
        })
        .map_err(ApiError::from_service_error)
}
