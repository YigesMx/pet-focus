use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;

use crate::core::{AppState, Feature};

/// Pomodoro Feature（预留）
/// 
/// 未来将实现番茄钟功能
pub struct PomodoroFeature;

impl PomodoroFeature {
    pub fn new() -> Arc<Self> {
        Arc::new(Self)
    }
}

#[async_trait]
impl Feature for PomodoroFeature {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
    
    fn name(&self) -> &'static str {
        "pomodoro"
    }

    fn command_names(&self) -> Vec<&'static str> {
        vec![]
    }

    async fn initialize(&self, _app_state: &AppState) -> Result<()> {
        println!("[PomodoroFeature] Initialized (placeholder)");
        Ok(())
    }
}

impl Default for PomodoroFeature {
    fn default() -> Self {
        Self
    }
}
