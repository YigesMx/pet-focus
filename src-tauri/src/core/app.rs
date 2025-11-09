use std::collections::HashMap;
use std::sync::Arc;

use sea_orm::DatabaseConnection;
use tauri::{AppHandle, Wry};

use crate::core::Feature;
use crate::features::todo::sync::CalDavSyncManager;
use crate::infrastructure::webserver::WebServerManager;
use crate::infrastructure::notification::NotificationManager;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::infrastructure::tray::TrayManager;

/// 应用全局状态
/// 
/// 管理所有 Features 和基础设施组件
pub struct AppState {
    app_handle: AppHandle<Wry>,
    db: DatabaseConnection,
    features: HashMap<&'static str, Arc<dyn Feature>>,
    
    // 通知管理器
    notification_manager: NotificationManager,
    
    // CalDAV 同步管理器
    caldav_sync_manager: CalDavSyncManager,
    
    // WebServer 管理器（桌面平台）
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    webserver_manager: WebServerManager,
    
    // 系统托盘管理器（桌面平台）
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    tray_manager: TrayManager,
}

impl AppState {
    pub fn new(
        app_handle: AppHandle<Wry>,
        db: DatabaseConnection,
        features: Vec<Arc<dyn Feature>>,
    ) -> Self {
        let mut feature_map = HashMap::new();
        for feature in features {
            feature_map.insert(feature.name(), feature);
        }

        // 创建通知管理器
        let notification_manager = NotificationManager::new(app_handle.clone());
        
        // 创建 CalDAV 同步管理器
        let caldav_sync_manager = CalDavSyncManager::new(db.clone(), app_handle.clone());

        Self {
            app_handle,
            db,
            features: feature_map,
            notification_manager,
            caldav_sync_manager,
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            webserver_manager: WebServerManager::new(),
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            tray_manager: TrayManager::new(),
        }
    }

    /// 获取数据库连接
    pub fn db(&self) -> &DatabaseConnection {
        &self.db
    }

    /// 获取 AppHandle
    pub fn app_handle(&self) -> AppHandle<Wry> {
        self.app_handle.clone()
    }

    /// 根据名称获取 Feature
    pub fn get_feature(&self, name: &str) -> Option<&Arc<dyn Feature>> {
        self.features.get(name)
    }

    /// 获取所有 Features
    pub fn features(&self) -> &HashMap<&'static str, Arc<dyn Feature>> {
        &self.features
    }

    /// 获取通知管理器
    pub fn notification(&self) -> &NotificationManager {
        &self.notification_manager
    }

    /// 获取 CalDAV 同步管理器
    pub fn caldav_sync_manager(&self) -> &CalDavSyncManager {
        &self.caldav_sync_manager
    }

    /// 获取 WebServer 管理器（仅桌面平台）
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    pub fn webserver_manager(&self) -> &WebServerManager {
        &self.webserver_manager
    }

    /// 获取 Tray 管理器（仅桌面平台）
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    pub fn tray_manager(&self) -> &TrayManager {
        &self.tray_manager
    }
    
    /// 获取 Todo Feature 的调度器
    pub fn todo_scheduler(&self) -> Option<&Arc<crate::features::todo::DueNotificationScheduler>> {
        use crate::features::todo::TodoFeature;
        
        self.get_feature("todo")
            .and_then(|feature| feature.as_any().downcast_ref::<TodoFeature>())
            .and_then(|todo_feature| todo_feature.scheduler())
    }

    /// 设置托盘注册表（仅桌面平台）
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    pub fn set_tray_registry(&mut self, registry: crate::infrastructure::tray::TrayRegistry) {
        self.tray_manager.set_registry(registry);
    }

    /// 后初始化阶段（在 app.manage() 之后调用）
    /// 
    /// 此时 AppState 已经被 Tauri 托管，可以通过 app.try_state() 访问。
    /// 执行需要访问已托管状态的初始化逻辑。
    pub async fn post_initialize(&self, app: &AppHandle<Wry>) -> anyhow::Result<()> {
        // 桌面平台特定的初始化
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            // 1. 创建系统托盘
            self.tray_manager
                .create_tray(app)
                .map_err(|e| anyhow::anyhow!("Failed to create tray: {}", e))?;
            
            // 2. 自动启动 WebServer（如果配置启用）
            self.webserver_manager
                .try_auto_start(self.db.clone(), app.clone())
                .await
                .map_err(|e| anyhow::anyhow!("Failed to auto-start web server: {}", e))?;
        }

        // 未来可以在这里添加桌面和移动平台通用的初始化逻辑

        Ok(())
    }
}
