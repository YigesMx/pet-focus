use std::{
    net::SocketAddr,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use anyhow::{Context, Result};
use sea_orm::DatabaseConnection;
use tauri::{
    async_runtime::{self, JoinHandle},
    AppHandle, Wry,
};
use tokio::{
    net::TcpListener,
    sync::{oneshot, Mutex},
};

use super::{
    config::{WebServerConfig, WebServerStatus},
    router::build_router,
    ws::{ApiContext, ConnectionManager},
};
use crate::infrastructure::webserver::api::HandlerRegistry;

#[derive(Clone)]
pub struct WebServerManager {
    inner: Arc<Mutex<Option<WebServerHandle>>>,
    default_config: Arc<WebServerConfig>,
    registry: Arc<Mutex<HandlerRegistry>>,
}

impl WebServerManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
            default_config: Arc::new(WebServerConfig::default()),
            registry: Arc::new(Mutex::new(HandlerRegistry::new())),
        }
    }

    /// 获取 HandlerRegistry 的可变引用（用于 Feature 注册 handlers）
    pub async fn registry_mut(&self) -> tokio::sync::MutexGuard<'_, HandlerRegistry> {
        self.registry.lock().await
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

        // 创建 API 上下文
        let ctx = ApiContext::new(db, app_handle, conn_mgr.clone());

        // 获取 registry 的克隆
        let registry = self.registry.lock().await.clone();

        // 保存 connection_manager 引用以便其他模块使用
        let conn_mgr_for_handle = conn_mgr.clone();

        // 构建 router
        let router = build_router(ctx, registry);
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
            addr: actual_addr,
            alive: alive_flag,
            connection_manager: conn_mgr_for_handle,
        });

        Ok(WebServerStatus::running(actual_addr))
    }

    /// 获取 ConnectionManager（如果 WebServer 正在运行）
    pub fn get_connection_manager(&self) -> Option<ConnectionManager> {
        let guard = self.inner.try_lock().ok()?;
        guard
            .as_ref()
            .map(|handle| handle.connection_manager.clone())
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

    /// 尝试根据配置自动启动 WebServer
    ///
    /// 从数据库读取 "webserver.auto_start" 配置，如果为 true 则启动服务器
    pub async fn try_auto_start(&self, db: DatabaseConnection, app: AppHandle<Wry>) -> Result<()> {
        use crate::features::settings::core::service::SettingService;

        match SettingService::get_bool(&db, "webserver.auto_start", false).await {
            Ok(true) => {
                println!("Auto-starting web server...");
                self.start(db, app, None).await?;
                Ok(())
            }
            Ok(false) => Ok(()),
            Err(e) => {
                eprintln!("Failed to read auto-start setting: {}", e);
                Err(e.into())
            }
        }
    }
}

struct WebServerHandle {
    shutdown: Option<oneshot::Sender<()>>,
    join: JoinHandle<()>,
    addr: SocketAddr,
    alive: Arc<AtomicBool>,
    connection_manager: ConnectionManager,
}

impl WebServerHandle {
    fn is_alive(&self) -> bool {
        self.alive.load(Ordering::SeqCst)
    }
}
