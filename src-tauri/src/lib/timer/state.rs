use serde::{Deserialize, Serialize};
// use std::sync::{Arc, Mutex};

// 允许我们发送给前端的模式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TimerMode {
    Work,
    ShortBreak,
    LongBreak,
}

// 包含所有计时器信息的状态结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerState {
    pub remaining_time: u32, // in seconds
    pub is_running: bool,
    pub mode: TimerMode,
    pub pomodoro_count: u32,
    // --- Settings ---
    // 我们也将设置存储在状态中
    pub work_duration: u32,
    pub short_break_duration: u32,
    pub long_break_duration: u32,
    pub long_break_interval: u32, // e.g., after 4 pomodoros
}

// 为 TimerState 实现 Default
impl Default for TimerState {
    fn default() -> Self {
        let work_duration = 10; // 25 分钟
        Self {
            remaining_time: work_duration,
            is_running: false,
            mode: TimerMode::Work,
            pomodoro_count: 0,
            work_duration,
            short_break_duration: 5, // 5 分钟
            long_break_duration: 5, // 15 分钟
            long_break_interval: 4,
        }
    }
}

// Tauri 管理的状态包装器
// pub struct AppState(pub Arc<Mutex<TimerState>>);
