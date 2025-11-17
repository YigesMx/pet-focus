// API 接口层
//
// 负责对外暴露接口:Tauri Commands（前端调用）、WebSocket Handlers（外部 API）、用户通知

pub mod commands;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod handlers;
pub mod notifications;
