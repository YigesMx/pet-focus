use std::{
    net::SocketAddr,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use anyhow::{Context, Result};
use sea_orm::DatabaseConnection;
use tokio::{
    net::TcpListener,
    sync::{oneshot, Mutex},
};
use tauri::{
    async_runtime::{self, JoinHandle},
    AppHandle,
    Wry,
};

use super::{
    connection::ConnectionManager,
    context::ApiContext,
    message::WsMessage,
    router::build_router,
    types::{WebServerConfig, WebServerStatus},
};

#[derive(Clone)]
pub struct WebServerManager {
    inner: Arc<Mutex<Option<WebServerHandle>>>,
    default_config: Arc<WebServerConfig>,
}

impl WebServerManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
            default_config: Arc::new(WebServerConfig::default()),
        }
    }

    pub async fn start(
        &self,
        db: DatabaseConnection,
        app_handle: AppHandle<Wry>,
        config: Option<WebServerConfig>,
    ) -> Result<WebServerStatus> {
        let mut guard = self.inner.lock().await;

        if let Some(handle) = guard.as_ref() {
            if handle.is_alive() {
                return Ok(WebServerStatus::running(handle.addr));
            }

            guard.take();
        }

        let config = config.unwrap_or_else(|| (*self.default_config).clone());
        let bind_addr = format!("{}:{}", config.host, config.port);
        let listener = TcpListener::bind(&bind_addr)
            .await
            .with_context(|| format!("failed to bind web server to {bind_addr}"))?;
        let actual_addr = listener
            .local_addr()
            .context("failed to read bound address for web server")?;
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

        // 创建连接管理器
        let conn_mgr = ConnectionManager::new();

        // 启动定时广播任务
        let conn_mgr_clone = conn_mgr.clone();
        let broadcast_task: JoinHandle<()> = async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
            loop {
                interval.tick().await;
                let event = WsMessage::event(
                    "placeholder".to_string(),
                    serde_json::json!({"timestamp": chrono::Utc::now().to_rfc3339()}),
                );
                conn_mgr_clone.broadcast_to_channel(&"placeholder".to_string(), event).await;
            }
        });

        let router = build_router(ApiContext::new(db, app_handle, conn_mgr));
        let server = axum::serve(listener, router).with_graceful_shutdown(async move {
            let _ = shutdown_rx.await;
        });

        let alive_flag = Arc::new(AtomicBool::new(true));
        let alive_for_task = Arc::clone(&alive_flag);

        let join: JoinHandle<()> = async_runtime::spawn(async move {
            if let Err(error) = server.await {
                eprintln!("web server encountered an error: {error}");
            }

            alive_for_task.store(false, Ordering::SeqCst);
        });

        *guard = Some(WebServerHandle {
            shutdown: Some(shutdown_tx),
            join,
            broadcast_task,
            addr: actual_addr,
            alive: alive_flag,
        });

        Ok(WebServerStatus::running(actual_addr))
    }

    pub async fn stop(&self) -> Result<WebServerStatus> {
        let handle = {
            let mut guard = self.inner.lock().await;
            guard.take()
        };

        if let Some(mut handle) = handle {
            if let Some(shutdown) = handle.shutdown.take() {
                let _ = shutdown.send(());
            }

            handle.broadcast_task.abort();

            if let Err(error) = handle.join.await {
                eprintln!("failed to join web server task: {error}");
            }
        }

        Ok(WebServerStatus::stopped())
    }

    pub async fn status(&self) -> WebServerStatus {
        let mut guard = self.inner.lock().await;

        if guard.as_ref().is_some_and(|handle| !handle.is_alive()) {
            guard.take();
        }

        guard
            .as_ref()
            .map(|handle| WebServerStatus::running(handle.addr))
            .unwrap_or_else(WebServerStatus::stopped)
    }
}

struct WebServerHandle {
    shutdown: Option<oneshot::Sender<()>>,
    join: JoinHandle<()>,
    broadcast_task: JoinHandle<()>,
    addr: SocketAddr,
    alive: Arc<AtomicBool>,
}

impl WebServerHandle {
    fn is_alive(&self) -> bool {
        self.alive.load(Ordering::SeqCst)
    }
}
