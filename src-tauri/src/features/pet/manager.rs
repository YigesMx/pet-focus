use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

#[derive(Clone)]
pub struct PetManager {
    child: Arc<Mutex<Option<CommandChild>>>,
    app: AppHandle,
}

impl PetManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            app,
        }
    }

    pub fn start(&self) -> Result<(), String> {
        let mut child_guard = self.child.lock().unwrap();
        if child_guard.is_some() {
            return Ok(()); // Already running
        }

        let sidecar = self
            .app
            .shell()
            .sidecar("Lynx")
            .map_err(|e| format!("Failed to create sidecar: {}", e))?;

        let (mut rx, child) = sidecar
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

        let child_arc = self.child.clone();

        // 监控进程状态
        tauri::async_runtime::spawn(async move {
            use tauri_plugin_shell::process::CommandEvent;
            while let Some(event) = rx.recv().await {
                if let CommandEvent::Terminated(_) = event {
                    let mut guard = child_arc.lock().unwrap();
                    *guard = None;
                    break;
                }
            }
            // 通道关闭，确保清理
            let mut guard = child_arc.lock().unwrap();
            if guard.is_some() {
                *guard = None;
            }
        });

        *child_guard = Some(child);
        println!("Pet process started");
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut child_guard = self.child.lock().unwrap();
        if let Some(child) = child_guard.take() {
            child
                .kill()
                .map_err(|e| format!("Failed to kill pet process: {}", e))?;
            println!("Pet process stopped");
        }
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        let child_guard = self.child.lock().unwrap();
        child_guard.is_some()
    }
}
