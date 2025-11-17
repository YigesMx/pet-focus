use std::sync::atomic::{AtomicU64, Ordering};

use axum::extract::ws::{Message, WebSocket};
use futures::{sink::SinkExt, stream::StreamExt};
use serde_json::Value;

use super::{
    connection::{ConnectionId, ConnectionManager},
    context::ApiContext,
    protocol::{CallBody, ListenBody, WsMessage},
};
use crate::infrastructure::webserver::{api::HandlerRegistry, core::router::RouterState};

static CONN_COUNTER: AtomicU64 = AtomicU64::new(0);

/// 处理 WebSocket 连接（顶层函数）
pub async fn handle_socket(socket: WebSocket, state: RouterState) {
    let (mut sender, mut receiver) = socket.split();

    let RouterState { ctx, registry } = state;
    let conn_mgr = ctx.connection_manager();

    // 生成唯一连接 ID
    let conn_id = format!("conn-{}", CONN_COUNTER.fetch_add(1, Ordering::SeqCst));

    // 创建接收通道
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

    // 注册连接
    conn_mgr.register(conn_id.clone(), tx).await;
    println!("WebSocket connection registered: {}", conn_id);

    // 发送任务：从通道接收消息并发送到 WebSocket
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // 接收任务
    let conn_id_clone = conn_id.clone();
    let conn_mgr_clone = conn_mgr.clone();
    let ctx_clone = ctx.clone();
    let registry_clone = registry.clone();

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                match serde_json::from_str::<WsMessage>(&text) {
                    Ok(WsMessage::Call { body: call }) => {
                        handle_call(
                            &conn_id_clone,
                            call,
                            &registry_clone,
                            &conn_mgr_clone,
                            &ctx_clone,
                        )
                        .await;
                    }
                    Ok(WsMessage::Listen { body: listen }) => {
                        handle_listen(&conn_id_clone, listen, &registry_clone, &conn_mgr_clone)
                            .await;
                    }
                    Ok(_) => {
                        eprintln!("Unexpected message type from client");
                    }
                    Err(e) => {
                        eprintln!("Failed to parse message: {}", e);
                    }
                }
            } else if let Message::Close(_) = msg {
                break;
            }
        }
    });

    // 等待任意任务完成
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }

    // 清理连接
    conn_mgr.unregister(&conn_id).await;
    println!("WebSocket connection closed: {}", conn_id);
}

/// 处理 Call 消息（RPC 调用）
async fn handle_call(
    conn_id: &ConnectionId,
    call: CallBody,
    registry: &HandlerRegistry,
    conn_mgr: &ConnectionManager,
    ctx: &ApiContext,
) {
    let CallBody { id, method, params } = call;

    let result = if let Some(handler) = registry.get_call_handler(&method) {
        // 执行注册的 handler
        handler(method.clone(), params.unwrap_or(Value::Null), ctx.clone())
            .await
            .map_err(|e| e.to_string())
    } else {
        Err(format!("Unknown method: {}", method))
    };

    let reply = match result {
        Ok(data) => WsMessage::reply_success(id, method, data),
        Err(err) => WsMessage::reply_error(id, method, err),
    };

    if let Err(e) = conn_mgr.send_to(conn_id, reply).await {
        eprintln!("Failed to send reply: {}", e);
    }
}

/// 处理 Listen 消息（订阅事件）
async fn handle_listen(
    conn_id: &ConnectionId,
    listen: ListenBody,
    registry: &HandlerRegistry,
    conn_mgr: &ConnectionManager,
) {
    let channel = listen.channel;

    // 验证事件是否已注册
    if registry.is_event_registered(&channel) {
        conn_mgr.subscribe(conn_id, channel.clone()).await;
        println!("Connection {} subscribed to {}", conn_id, channel);

        // 发送订阅成功响应
        let response = WsMessage::reply_success(
            format!("listen-{}", channel),
            "listen".to_string(),
            serde_json::json!({
                "subscribed": true,
                "event": channel
            }),
        );
        let _ = conn_mgr.send_to(conn_id, response).await;
    } else {
        // 发送订阅失败响应
        eprintln!(
            "Connection {} attempted to subscribe to unregistered event: {}",
            conn_id, channel
        );
        let response = WsMessage::reply_error(
            format!("listen-{}", channel),
            "listen".to_string(),
            format!("Event '{}' is not registered", channel),
        );
        let _ = conn_mgr.send_to(conn_id, response).await;
    }
}
