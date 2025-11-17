use anyhow::Result;
use async_trait::async_trait;

use crate::core::{AppState, Feature};

/// Window Feature - 窗口管理功能
///
/// 提供窗口显示/隐藏/切换等功能
pub struct WindowFeature;

impl WindowFeature {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Feature for WindowFeature {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn name(&self) -> &'static str {
        "window"
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    fn register_ws_handlers(
        &self,
        registry: &mut crate::infrastructure::webserver::HandlerRegistry,
    ) {
        super::api::handlers::register_handlers(registry);
    }

    async fn initialize(&self, _app_state: &AppState) -> Result<()> {
        println!("[WindowFeature] Initialized");
        Ok(())
    }

    async fn cleanup(&self) -> Result<()> {
        println!("[WindowFeature] Cleaned up");
        Ok(())
    }
}
