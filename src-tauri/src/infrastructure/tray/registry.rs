use std::sync::Arc;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    AppHandle, Wry,
};

/// 托盘菜单项定义
///
/// 每个 Feature 可以提供多个托盘菜单项，包含：
/// - id: 唯一标识符
/// - label: 显示文本
/// - handler: 点击时的回调函数
/// - is_visible: 每次构建菜单时判断是否显示
pub struct TrayMenuItem {
    pub id: String,
    pub label: String,
    pub handler: Arc<dyn Fn(&AppHandle) + Send + Sync>,
    pub is_visible: Arc<dyn Fn(&AppHandle) -> bool + Send + Sync>,
}

impl TrayMenuItem {
    /// 创建托盘菜单项
    pub fn new<F, V>(
        id: impl Into<String>,
        label: impl Into<String>,
        handler: F,
        is_visible: V,
    ) -> Self
    where
        F: Fn(&AppHandle) + Send + Sync + 'static,
        V: Fn(&AppHandle) -> bool + Send + Sync + 'static,
    {
        Self {
            id: id.into(),
            label: label.into(),
            handler: Arc::new(handler),
            is_visible: Arc::new(is_visible),
        }
    }

    /// 创建总是可见的托盘菜单项
    pub fn always_visible<F>(id: impl Into<String>, label: impl Into<String>, handler: F) -> Self
    where
        F: Fn(&AppHandle) + Send + Sync + 'static,
    {
        Self::new(id, label, handler, |_| true)
    }
}

/// 托盘菜单布局项
///
/// 用于在 registry 中手动布局菜单结构
pub enum TrayMenuLayout {
    /// 菜单项
    Item(TrayMenuItem),
    /// 分隔符
    Separator,
}

/// 托盘注册表
///
/// **不再是收集各个 Feature 的注册项，而是手动布局菜单结构**
///
/// 类似于 `lib.rs` 中手动注册 commands，这里也需要手动引入各个 Feature 的托盘项并布局。
pub struct TrayRegistry {
    layout: Vec<TrayMenuLayout>,
}

impl TrayRegistry {
    pub fn new() -> Self {
        Self { layout: Vec::new() }
    }

    /// 添加菜单项到布局
    pub fn add_item(&mut self, item: TrayMenuItem) {
        self.layout.push(TrayMenuLayout::Item(item));
    }

    /// 添加分隔符到布局
    pub fn add_separator(&mut self) {
        self.layout.push(TrayMenuLayout::Separator);
    }

    /// 根据布局构建托盘菜单
    pub fn build_menu(&self, app: &AppHandle<Wry>) -> tauri::Result<Menu<Wry>> {
        let mut menu_items: Vec<Box<dyn tauri::menu::IsMenuItem<Wry>>> = Vec::new();

        for layout_item in &self.layout {
            match layout_item {
                TrayMenuLayout::Item(item) => {
                    // 检查可见性
                    if (item.is_visible)(app) {
                        let menu_item =
                            MenuItem::with_id(app, &item.id, &item.label, true, None::<&str>)?;
                        menu_items.push(Box::new(menu_item));
                    }
                }
                TrayMenuLayout::Separator => {
                    let separator = PredefinedMenuItem::separator(app)?;
                    menu_items.push(Box::new(separator));
                }
            }
        }

        // 转换为引用
        let menu_item_refs: Vec<&dyn tauri::menu::IsMenuItem<Wry>> = menu_items
            .iter()
            .map(|item| &**item as &dyn tauri::menu::IsMenuItem<Wry>)
            .collect();

        Menu::with_items(app, &menu_item_refs)
    }

    /// 获取所有布局项
    pub fn layout(&self) -> &[TrayMenuLayout] {
        &self.layout
    }
}

impl Default for TrayRegistry {
    fn default() -> Self {
        Self::new()
    }
}
