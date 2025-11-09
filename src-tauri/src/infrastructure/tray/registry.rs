use std::sync::Arc;

use tauri::{
    menu::Menu,
    AppHandle,
};

/// 托盘菜单项定义
pub struct TrayMenuItem {
    pub id: String,
    pub label: String,
    pub handler: Arc<dyn Fn(&AppHandle) + Send + Sync>,
}

/// 托盘注册表
/// 
/// 用于收集所有 Features 注册的托盘菜单项
pub struct TrayRegistry {
    items: Vec<TrayMenuItem>,
}

impl TrayRegistry {
    pub fn new() -> Self {
        Self { items: Vec::new() }
    }

    /// 注册一个托盘菜单项
    pub fn register_item<F>(&mut self, id: impl Into<String>, label: impl Into<String>, handler: F)
    where
        F: Fn(&AppHandle) + Send + Sync + 'static,
    {
        self.items.push(TrayMenuItem {
            id: id.into(),
            label: label.into(),
            handler: Arc::new(handler),
        });
    }

    /// 构建托盘菜单
    pub fn build_menu(&self, app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
        let menu = Menu::new(app)?;
        
        // TODO: 根据注册的 items 构建菜单
        // 当前先返回空菜单，后续实现
        
        Ok(menu)
    }

    /// 获取所有注册的菜单项
    pub fn items(&self) -> &[TrayMenuItem] {
        &self.items
    }
}

impl Default for TrayRegistry {
    fn default() -> Self {
        Self::new()
    }
}
