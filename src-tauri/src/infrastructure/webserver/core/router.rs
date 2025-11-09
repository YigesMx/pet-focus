use std::sync::Arc;

use axum::{
    extract::{ws::WebSocketUpgrade, State},
    response::IntoResponse,
    routing::any,
    Router,
};

use super::ws::{handler::handle_socket, ApiContext};
use crate::infrastructure::webserver::api::HandlerRegistry;

/// Router 状态（包含 Context 和 HandlerRegistry）
#[derive(Clone)]
pub(crate) struct RouterState {
    pub ctx: ApiContext,
    pub registry: Arc<HandlerRegistry>,
}

/// 构建 Axum Router
pub(super) fn build_router(ctx: ApiContext, registry: HandlerRegistry) -> Router {
    let state = RouterState {
        ctx,
        registry: Arc::new(registry),
    };

    Router::new()
        .route("/ws", any(ws_handler))
        .with_state(state)
}

/// WebSocket 升级处理器
async fn ws_handler(ws: WebSocketUpgrade, State(state): State<RouterState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}
