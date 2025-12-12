use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::OnceCell;

use crate::core::{AppState, Feature};

use super::manager::PetManager;

pub struct PetFeature {
    manager: OnceCell<Arc<PetManager>>,
}

impl PetFeature {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            manager: OnceCell::new(),
        })
    }

    pub fn manager(&self) -> Option<&Arc<PetManager>> {
        self.manager.get()
    }
}

#[async_trait]
impl Feature for PetFeature {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn name(&self) -> &'static str {
        "pet"
    }

    fn command_names(&self) -> Vec<&'static str> {
        vec!["pet_start", "pet_stop", "pet_status"]
    }

    async fn initialize(&self, app_state: &AppState) -> Result<()> {
        let manager = Arc::new(PetManager::new(app_state.app_handle()));

        // 检查自动启动设置 (默认为 true)
        let should_start =
            crate::features::settings::core::service::SettingService::get_or_default(
                app_state.db(),
                "pet.auto_start",
                "true",
            )
            .await
            .map(|v| v == "true")
            .unwrap_or(true);

        // 启动逻辑
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            if should_start {
                if let Err(e) = manager.start() {
                    eprintln!("Failed to auto-start pet: {}", e);
                }
            }
        }

        self.manager
            .set(manager)
            .map_err(|_| anyhow::anyhow!("PetManager already initialized"))?;

        println!("[PetFeature] Initialized");
        Ok(())
    }
}
