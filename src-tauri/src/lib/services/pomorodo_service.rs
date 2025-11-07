use anyhow::{Context, Result};
use sea_orm::DatabaseConnection;

use super::setting_service::SettingService;
use std::sync::{Arc, Mutex};
use crate::lib::timer::state::{TimerMode, TimerState};

// Settings keys used to persist Pomodoro configuration
const KEY_WORK_DURATION: &str = "timer.work_duration";           // seconds
const KEY_SHORT_BREAK_DURATION: &str = "timer.short_break_duration"; // seconds
const KEY_LONG_BREAK_DURATION: &str = "timer.long_break_duration";   // seconds
const KEY_LONG_BREAK_INTERVAL: &str = "timer.long_break_interval";   // count
const KEY_POMODORO_COUNT: &str = "timer.pomodoro_count";             // count

// Default values kept consistent with current TimerState defaults
const DEFAULT_WORK_DURATION: u32 = 10;       // seconds (dev/test default)
const DEFAULT_SHORT_BREAK_DURATION: u32 = 5; // seconds
const DEFAULT_LONG_BREAK_DURATION: u32 = 5;  // seconds
const DEFAULT_LONG_BREAK_INTERVAL: u32 = 4;  // count

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroSettings {
    pub work_duration: u32,
    pub short_break_duration: u32,
    pub long_break_duration: u32,
    pub long_break_interval: u32,
}

impl Default for PomodoroSettings {
    fn default() -> Self {
        Self {
            work_duration: DEFAULT_WORK_DURATION,
            short_break_duration: DEFAULT_SHORT_BREAK_DURATION,
            long_break_duration: DEFAULT_LONG_BREAK_DURATION,
            long_break_interval: DEFAULT_LONG_BREAK_INTERVAL,
        }
    }
}

/// 读取番茄钟设置（秒与次数），若不存在则返回内部默认常量
pub async fn get_settings(db: &DatabaseConnection) -> Result<PomodoroSettings> {
    let def = PomodoroSettings::default();

    let work_duration = get_u32(db, KEY_WORK_DURATION, def.work_duration).await?;
    let short_break_duration = get_u32(db, KEY_SHORT_BREAK_DURATION, def.short_break_duration).await?;
    let long_break_duration = get_u32(db, KEY_LONG_BREAK_DURATION, def.long_break_duration).await?;
    let long_break_interval = get_u32(db, KEY_LONG_BREAK_INTERVAL, def.long_break_interval).await?;

    Ok(PomodoroSettings {
        work_duration,
        short_break_duration,
        long_break_duration,
        long_break_interval,
    })
}

/// 保存番茄钟设置（秒与次数），返回保存后的设置
pub async fn set_settings(db: &DatabaseConnection, settings: PomodoroSettings) -> Result<PomodoroSettings> {
    SettingService::set(db, KEY_WORK_DURATION, &settings.work_duration.to_string())
        .await
        .context("failed to save work_duration")?;
    SettingService::set(db, KEY_SHORT_BREAK_DURATION, &settings.short_break_duration.to_string())
        .await
        .context("failed to save short_break_duration")?;
    SettingService::set(db, KEY_LONG_BREAK_DURATION, &settings.long_break_duration.to_string())
        .await
        .context("failed to save long_break_duration")?;
    SettingService::set(db, KEY_LONG_BREAK_INTERVAL, &settings.long_break_interval.to_string())
        .await
        .context("failed to save long_break_interval")?;

    Ok(settings)
}

/// 获取累计完成的番茄数（可用于跨启动持久化计数）
pub async fn get_pomodoro_count(db: &DatabaseConnection) -> Result<u32> {
    let def = 0u32;
    get_u32(db, KEY_POMODORO_COUNT, def).await
}

/// 设置累计番茄数
pub async fn set_pomodoro_count(db: &DatabaseConnection, count: u32) -> Result<()> {
    SettingService::set(db, KEY_POMODORO_COUNT, &count.to_string())
        .await
        .context("failed to save pomodoro_count")?;
    Ok(())
}

// --- helpers ---

async fn get_u32(db: &DatabaseConnection, key: &str, default: u32) -> Result<u32> {
    let s = SettingService::get_or_default(db, key, &default.to_string())
        .await
        .with_context(|| format!("failed to read setting {key}"))?;
    Ok(s.parse::<u32>().unwrap_or(default))
}

/// 从数据库读取番茄钟设置并应用到运行时状态
pub async fn apply_settings_to_state(
    db: &DatabaseConnection,
    timer: &Arc<Mutex<TimerState>>,
) -> Result<()> {
    let s = get_settings(db).await?;

    let mut guard = timer.lock().unwrap();
    guard.work_duration = s.work_duration;
    guard.short_break_duration = s.short_break_duration;
    guard.long_break_duration = s.long_break_duration;
    guard.long_break_interval = s.long_break_interval;

    // 未在运行时，按当前模式重算剩余时间，避免打断正在进行的倒计时
    if !guard.is_running {
        guard.remaining_time = match guard.mode {
            TimerMode::Work => guard.work_duration,
            TimerMode::ShortBreak => guard.short_break_duration,
            TimerMode::LongBreak => guard.long_break_duration,
        };
    }

    Ok(())
}
