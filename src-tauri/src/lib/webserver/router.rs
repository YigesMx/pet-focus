use std::sync::atomic::{AtomicU64, Ordering};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::any,
    Router,
};
use futures::{sink::SinkExt, stream::StreamExt};

use super::{context::ApiContext, handler::handle_call, message::WsMessage};

static CONN_COUNTER: AtomicU64 = AtomicU64::new(0);

pub(super) fn build_router(state: ApiContext) -> Router {
    Router::new()
        .route("/ws", any(ws_handler))
        .with_state(state)
}

/// WebSocket 升级处理器
async fn ws_handler(ws: WebSocketUpgrade, State(ctx): State<ApiContext>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, ctx))
}

/// 处理 WebSocket 连接
async fn handle_socket(socket: WebSocket, ctx: ApiContext) {
    let (mut sender, mut receiver) = socket.split();

    // 注册连接
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
    let db = ctx.db().clone();
    let ctx_clone = ctx.clone();

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                match serde_json::from_str::<WsMessage>(&text) {
                    Ok(WsMessage::Call { body: call }) => {
                        handle_call(&conn_id_clone, call, &db, &conn_mgr_clone, &ctx_clone).await;
                    }
                    Ok(WsMessage::Listen { body: listen }) => {
                        let channel = listen.channel;
                        conn_mgr_clone
                            .subscribe(&conn_id_clone, channel.clone())
                            .await;
                        println!("Connection {} subscribed to {}", conn_id_clone, channel);
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
