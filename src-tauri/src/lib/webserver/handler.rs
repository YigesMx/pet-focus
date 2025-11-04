use sea_orm::DatabaseConnection;
use serde_json::{json, Value};

use super::{
    connection::{ConnectionId, ConnectionManager},
    context::ApiContext,
    message::{CallBody, WsMessage},
};
use crate::lib::services::todo_service;

/// 处理 Call 请求
pub async fn handle_call(
    conn_id: &ConnectionId,
    call: CallBody,
    db: &DatabaseConnection,
    conn_mgr: &ConnectionManager,
    ctx: &ApiContext,
) {
    let CallBody { id, method, params } = call;

    let result = match method.as_str() {
        "list_todos" => handle_list_todos(db).await,
        "get_todo" => handle_get_todo(db, params).await,
        "create_todo" => handle_create_todo(db, params, ctx).await,
        "update_todo" => handle_update_todo(db, params, ctx).await,
        "delete_todo" => handle_delete_todo(db, params, ctx).await,
        _ => Err(format!("Unknown method: {}", method)),
    };

    let reply = match result {
        Ok(data) => WsMessage::reply_success(id, method, data),
        Err(err) => WsMessage::reply_error(id, method, err),
    };

    if let Err(e) = conn_mgr.send_to(conn_id, reply).await {
        eprintln!("Failed to send reply: {}", e);
    }
}

/// 列出所有待办
async fn handle_list_todos(db: &DatabaseConnection) -> Result<Value, String> {
    let todos = todo_service::list_todos(db)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(json!(todos))
}

/// 获取单个待办
async fn handle_get_todo(db: &DatabaseConnection, params: Option<Value>) -> Result<Value, String> {
    let params = params.ok_or("Missing params")?;
    
    let id = params
        .get("id")
        .and_then(|v| v.as_i64())
        .ok_or("Missing or invalid id")? as i32;

    let todo = todo_service::get_todo(db, id)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(json!(todo))
}

/// 创建待办
async fn handle_create_todo(
    db: &DatabaseConnection,
    params: Option<Value>,
    ctx: &ApiContext,
) -> Result<Value, String> {
    let title = params
        .and_then(|p| p.get("title").and_then(|t| t.as_str()).map(String::from));

    let todo = todo_service::create_todo(db, title)
        .await
        .map_err(|e| e.to_string())?;
    
    // 通知前端数据变更
    ctx.notify_change("created", Some(todo.id));
    
    Ok(json!(todo))
}

/// 更新待办
async fn handle_update_todo(
    db: &DatabaseConnection,
    params: Option<Value>,
    ctx: &ApiContext,
) -> Result<Value, String> {
    let params = params.ok_or("Missing params")?;
    
    let id = params
        .get("id")
        .and_then(|v| v.as_i64())
        .ok_or("Missing or invalid id")? as i32;
    
    let title = params
        .get("title")
        .and_then(|v| v.as_str())
        .map(String::from);
    
    let completed = params
        .get("completed")
        .and_then(|v| v.as_bool());

    let todo = todo_service::update_todo(db, id, title, completed)
        .await
        .map_err(|e| e.to_string())?;
    
    // 通知前端数据变更
    ctx.notify_change("updated", Some(id));
    
    Ok(json!(todo))
}

/// 删除待办
async fn handle_delete_todo(
    db: &DatabaseConnection,
    params: Option<Value>,
    ctx: &ApiContext,
) -> Result<Value, String> {
    let params = params.ok_or("Missing params")?;
    
    let id = params
        .get("id")
        .and_then(|v| v.as_i64())
        .ok_or("Missing or invalid id")? as i32;

    todo_service::delete_todo(db, id)
        .await
        .map_err(|e| e.to_string())?;
    
    // 通知前端数据变更
    ctx.notify_change("deleted", Some(id));
    
    Ok(json!({"success": true}))
}
