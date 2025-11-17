// Settings Feature - 设置管理
//
// 分层架构：
// - api/: API 接口层（commands）
// - core/: 核心业务层（service, models）
// - data/: 数据访问层（entity, migration）

pub mod api;
pub mod core;
pub mod data;
pub mod feature;

pub use feature::SettingsFeature;
