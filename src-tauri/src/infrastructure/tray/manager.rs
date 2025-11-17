use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Wry,
};

use super::registry::TrayRegistry;
use crate::features::window::manager as window;

/// 托盘管理器
pub struct TrayManager {
    registry: TrayRegistry,
}

impl TrayManager {
    pub fn new() -> Self {
        Self {
            registry: TrayRegistry::new(),
        }
    }

    /// 设置托盘注册表（由 AppState 初始化时调用）
    pub fn set_registry(&mut self, registry: TrayRegistry) {
        self.registry = registry;
    }

    /// 创建系统托盘
    pub fn create_tray(&self, app: &AppHandle<Wry>) -> tauri::Result<()> {
        // 根据 registry 构建菜单
        let menu = self.registry.build_menu(app)?;

        // 提取所有 handlers 到一个 HashMap 中（克隆 Arc）
        use std::collections::HashMap;
        use std::sync::Arc;
        let mut handlers: HashMap<String, Arc<dyn Fn(&AppHandle) + Send + Sync>> = HashMap::new();
        for layout_item in self.registry.layout() {
            if let super::registry::TrayMenuLayout::Item(item) = layout_item {
                handlers.insert(item.id.clone(), item.handler.clone());
            }
        }

        let _tray = TrayIconBuilder::with_id("main")
            .icon(app.default_window_icon().unwrap().clone())
            .menu(&menu)
            .show_menu_on_left_click(false) // 左键不显示菜单
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    let app = tray.app_handle();
                    let _ = window::show_main_window(&app);
                }
            })
            .on_menu_event(move |app, event| {
                // 从 handlers map 中查找并调用对应的 handler
                if let Some(handler) = handlers.get(event.id.as_ref()) {
                    handler(&app);
                }
            })
            .build(app)?;

        Ok(())
    }

    /// 更新托盘菜单
    ///
    /// 重新构建菜单（会重新评估所有 is_visible 条件）
    pub fn update_tray_menu(&self, app: &AppHandle<Wry>) -> tauri::Result<()> {
        if let Some(tray) = app.tray_by_id("main") {
            let new_menu = self.registry.build_menu(app)?;
            tray.set_menu(Some(new_menu))?;
        }
        Ok(())
    }

    /// 设置托盘 Tooltip 文本
    pub fn set_tooltip(&self, app: &AppHandle<Wry>, text: &str) -> tauri::Result<()> {
        if let Some(tray) = app.tray_by_id("main") {
            tray.set_tooltip(Some(text))?;
        }
        Ok(())
    }
}

impl Default for TrayManager {
    fn default() -> Self {
        Self::new()
    }
}
