// Window Feature - 窗口管理
//
// 架构：
// - api/: API 接口层（handlers, notifications）
// - manager: 窗口管理器（底层实现、事件回调）

pub mod api;
pub mod feature;
pub mod manager;

pub use feature::WindowFeature;
