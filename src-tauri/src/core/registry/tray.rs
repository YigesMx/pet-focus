use crate::infrastructure::tray::TrayRegistry;

/// 构建托盘注册表（手动布局菜单）
///
/// 类似于手动注册 commands，这里也需要手动引入各个模块的托盘项并布局
pub fn build_tray_registry() -> TrayRegistry {
    let mut registry = TrayRegistry::new();

    // 从各个模块导入托盘菜单项
    use crate::features::window::api::tray as window_tray;
    use crate::infrastructure::tray::quit_app_item;
    use crate::infrastructure::webserver::api::tray as webserver_tray;

    // 手动布局菜单结构
    registry.add_item(window_tray::toggle_window_item());
    registry.add_separator();
    registry.add_item(webserver_tray::start_webserver_item());
    registry.add_item(webserver_tray::stop_webserver_item());
    registry.add_separator();
    registry.add_item(quit_app_item());

    registry
}
