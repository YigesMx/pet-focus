// Todo Feature - 待办事项管理
//
// 分层架构：
// - api/: API 接口层（commands, handlers, notifications）
// - core/: 核心业务层（service, scheduler, models）
// - data/: 数据访问层（entity, migration）
// - sync/: CalDAV 同步子模块

pub mod api;
pub mod core;
pub mod data;
pub mod feature;
pub mod sync;

pub use core::scheduler::DueNotificationScheduler;
pub use feature::TodoFeature;
