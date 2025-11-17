use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Manager, Wry};
use tokio::{sync::Mutex, time::sleep};

use crate::features::pomodoro::core::models::{PomodoroSessionKind, PomodoroSessionStatus};
use crate::features::pomodoro::core::service as pomo_service;
use crate::infrastructure::notification::NotificationManager;
use chrono::Utc;

use super::models::{PomodoroConfig, PomodoroMode, PomodoroStatus};

pub const POMODORO_STATUS_EVENT: &str = "pomodoro-status";
pub const POMODORO_TICK_EVENT: &str = "pomodoro-tick";
pub const POMODORO_SESSION_RECORDED_EVENT: &str = "pomodoro-session-recorded";
pub const WS_EVENT_STATUS: &str = "pomodoro.status";
pub const WS_EVENT_TICK: &str = "pomodoro.tick";

#[derive(Debug)]
struct State {
    running: bool,
    paused: bool,
    mode: PomodoroMode,
    remaining_seconds: u32,
    round: u32,
    phase_started_at: Option<chrono::DateTime<chrono::Utc>>,
    generation: u64, // 用于标记 tick 任务的版本，每次启动时递增
}

pub struct PomodoroManager {
    app: AppHandle<Wry>,
    notifier: NotificationManager,
    state: Arc<Mutex<State>>,
    tick_task: Mutex<Option<JoinHandle<()>>>,
}

impl PomodoroManager {
    pub fn new(app: AppHandle<Wry>, notifier: NotificationManager) -> Self {
        Self {
            app,
            notifier,
            state: Arc::new(Mutex::new(State {
                running: false,
                paused: false,
                mode: PomodoroMode::Idle,
                remaining_seconds: 0,
                round: 0,
                phase_started_at: None,
                generation: 0,
            })),
            tick_task: Mutex::new(None),
        }
    }

    pub async fn start(&self, cfg: PomodoroConfig) -> Result<PomodoroStatus> {
        {
            let mut s = self.state.lock().await;
            s.running = true;
            s.paused = false;
            s.mode = PomodoroMode::Focus;
            s.remaining_seconds = cfg.focus_minutes * 60;
            s.round = s.round.max(0);
            s.phase_started_at = Some(Utc::now());
            s.generation = s.generation.wrapping_add(1); // 递增 generation 以终止旧任务
        }

        self.spawn_tick_loop(cfg).await;
        self.notify_phase_start(PomodoroMode::Focus).await;
        Ok(self.status().await)
    }

    pub async fn pause(&self) -> PomodoroStatus {
        let mut s = self.state.lock().await;
        s.paused = true;
        drop(s);
        self.broadcast_status().await;
        self.status().await
    }

    pub async fn resume(&self) -> PomodoroStatus {
        let mut s = self.state.lock().await;
        s.paused = false;
        drop(s);
        self.broadcast_status().await;
        self.status().await
    }

    pub async fn skip(&self, cfg: PomodoroConfig) -> PomodoroStatus {
        // 持久化当前阶段为 skipped
        if let Err(e) =
            persist_with_status(&self.state, &self.app, PomodoroSessionStatus::Skipped).await
        {
            eprintln!("persist skipped error: {}", e);
        }
        self.advance_phase(cfg).await;
        self.status().await
    }

    pub async fn stop(&self) -> PomodoroStatus {
        {
            let mut s = self.state.lock().await;
            s.running = false;
            s.paused = false;
            s.mode = PomodoroMode::Idle;
            s.remaining_seconds = 0;
            s.round = s.round;
            s.generation = s.generation.wrapping_add(1); // 递增 generation 以终止旧任务
        }
        // 持久化当前阶段为 stopped（如果有进行中的阶段）
        if let Err(e) =
            persist_with_status(&self.state, &self.app, PomodoroSessionStatus::Stopped).await
        {
            eprintln!("persist stopped error: {}", e);
        }
        self.abort_tick().await;
        self.broadcast_status().await;
        self.status().await
    }

    pub async fn status(&self) -> PomodoroStatus {
        let s = self.state.lock().await;
        PomodoroStatus {
            running: s.running,
            paused: s.paused,
            mode: s.mode,
            remaining_seconds: s.remaining_seconds,
            round: s.round,
        }
    }

    async fn spawn_tick_loop(&self, cfg: PomodoroConfig) {
        self.abort_tick().await;
        let manager_app = self.app.clone();
        let notifier = self.notifier.clone();
        let state_ptr = Arc::clone(&self.state);

        // 记录当前 generation，用于检测任务是否已过期
        let current_generation = {
            let s = state_ptr.lock().await;
            s.generation
        };

        let handle = tauri::async_runtime::spawn(async move {
            loop {
                sleep(Duration::from_secs(1)).await;
                let mut finished = false;
                let mut mode = PomodoroMode::Idle;
                let mut remaining = 0u32;

                {
                    let mut s = state_ptr.lock().await;
                    // 检查 generation 是否匹配，不匹配说明有新任务启动，当前任务应该退出
                    if s.generation != current_generation {
                        break;
                    }
                    if !s.running {
                        break;
                    }
                    if s.paused {
                        // 仅广播 tick，不减少时间
                        remaining = s.remaining_seconds;
                        mode = s.mode;
                    } else {
                        if s.remaining_seconds > 0 {
                            s.remaining_seconds -= 1;
                        }
                        remaining = s.remaining_seconds;
                        mode = s.mode;
                        if s.remaining_seconds == 0 {
                            finished = true;
                        }
                    }
                }

                // 广播 tick
                let _ = manager_app.emit(
                    POMODORO_TICK_EVENT,
                    serde_json::json!({
                        "remainingSeconds": remaining,
                    }),
                );
                notifier.send_websocket_event(
                    WS_EVENT_TICK.to_string(),
                    serde_json::json!({
                        "remainingSeconds": remaining,
                        "mode": format_mode(mode),
                    }),
                );

                // 更新托盘 tooltip（桌面）
                update_tray_tooltip(&manager_app, mode, remaining).await;

                if finished {
                    // 阶段结束，切换下一阶段
                    // 持久化本阶段
                    if let Err(e) = persist_finished_phase(&state_ptr, &manager_app).await {
                        eprintln!("Pomodoro persist error: {}", e);
                    }
                    if let Err(e) =
                        advance_phase_internal(&state_ptr, &notifier, &manager_app, cfg.clone())
                            .await
                    {
                        eprintln!("Pomodoro advance phase error: {}", e);
                        break;
                    }
                }
            }
        });

        *self.tick_task.lock().await = Some(handle);
        self.broadcast_status().await;
    }

    async fn abort_tick(&self) {
        let _ = self.tick_task.lock().await.take();
    }

    async fn advance_phase(&self, cfg: PomodoroConfig) {
        if let Err(e) = advance_phase_internal(&self.state, &self.notifier, &self.app, cfg).await {
            eprintln!("advance phase error: {}", e);
        }
    }

    async fn notify_phase_start(&self, mode: PomodoroMode) {
        let (title, body) = match mode {
            PomodoroMode::Focus => ("开始专注", "进入专注阶段"),
            PomodoroMode::ShortBreak => ("短休开始", "放松一下"),
            PomodoroMode::LongBreak => ("长休开始", "好好休息"),
            PomodoroMode::Idle => ("空闲", ""),
        };
        let _ = self.notifier.send_toast(
            title.to_string(),
            crate::infrastructure::notification::ToastLevel::Info,
        );
        let _ = self
            .notifier
            .send_native(title.to_string(), body.to_string());
        self.broadcast_status().await;
    }

    async fn broadcast_status(&self) {
        let status = self.status().await;
        let _ = self.app.emit(POMODORO_STATUS_EVENT, &status);
        self.notifier.send_websocket_event(
            WS_EVENT_STATUS.to_string(),
            serde_json::to_value(&status).unwrap_or_default(),
        );
    }
}

async fn advance_phase_internal(
    state_ptr: &Mutex<State>,
    notifier: &NotificationManager,
    app: &AppHandle<Wry>,
    cfg: PomodoroConfig,
) -> Result<()> {
    let next_mode;
    let mut next_seconds = 0u32;
    let mut _next_round;

    {
        let mut s = state_ptr.lock().await;
        match s.mode {
            PomodoroMode::Focus => {
                // 完成一个专注
                s.round += 1;
                let is_long = s.round % cfg.long_break_interval == 0 && cfg.long_break_interval > 0;
                next_mode = if is_long {
                    PomodoroMode::LongBreak
                } else {
                    PomodoroMode::ShortBreak
                };
                next_seconds = (if is_long {
                    cfg.long_break_minutes
                } else {
                    cfg.short_break_minutes
                }) * 60;
            }
            PomodoroMode::ShortBreak | PomodoroMode::LongBreak | PomodoroMode::Idle => {
                next_mode = PomodoroMode::Focus;
                next_seconds = cfg.focus_minutes * 60;
            }
        }

        s.mode = next_mode;
        s.remaining_seconds = next_seconds;
        s.paused = false;
        s.running = true;
        _next_round = s.round;
        s.phase_started_at = Some(Utc::now());
    }

    // 阶段开始通知与广播
    let (title, body) = match next_mode {
        PomodoroMode::Focus => ("开始专注", "进入专注阶段"),
        PomodoroMode::ShortBreak => ("短休开始", "放松一下"),
        PomodoroMode::LongBreak => ("长休开始", "好好休息"),
        PomodoroMode::Idle => ("空闲", ""),
    };
    let _ = notifier.send_toast(
        title.to_string(),
        crate::infrastructure::notification::ToastLevel::Info,
    );
    let _ = notifier.send_native(title.to_string(), body.to_string());

    // 立即广播最新状态 & 更新托盘
    let status = {
        let s = state_ptr.lock().await;
        PomodoroStatus {
            running: s.running,
            paused: s.paused,
            mode: s.mode,
            remaining_seconds: s.remaining_seconds,
            round: s.round,
        }
    };
    let _ = app.emit(POMODORO_STATUS_EVENT, &status);
    notifier.send_websocket_event(
        WS_EVENT_STATUS.to_string(),
        serde_json::to_value(&status).unwrap_or_default(),
    );
    update_tray_tooltip(app, next_mode, next_seconds).await;

    Ok(())
}

async fn persist_finished_phase(state_ptr: &Arc<Mutex<State>>, app: &AppHandle<Wry>) -> Result<()> {
    use tauri::Manager;
    let (mode, started_at, round) = {
        let s = state_ptr.lock().await;
        (s.mode, s.phase_started_at, s.round)
    };
    let Some(start_at) = started_at else {
        return Ok(());
    };
    let end_at = Utc::now();
    let kind = match mode {
        PomodoroMode::Focus => PomodoroSessionKind::Focus,
        _ => PomodoroSessionKind::Rest,
    };

    if let Some(state) = app.try_state::<crate::core::AppState>() {
        let db = state.db().clone();

        // 获取或创建活动 session（自动创建时不带备注）
        let active_session = pomo_service::get_or_create_active_session(&db, None).await?;

        // 创建 record 并关联到 session
        pomo_service::create_record_with_session(
            &db,
            active_session.id,
            kind,
            PomodoroSessionStatus::Completed,
            round,
            start_at,
            end_at,
            None,
        )
        .await?;

        // 发送会话记录更新事件
        println!("发送会话记录事件: {}", POMODORO_SESSION_RECORDED_EVENT);
        let _ = app.emit(POMODORO_SESSION_RECORDED_EVENT, ());
    }
    Ok(())
}

async fn persist_with_status(
    state_ptr: &Arc<Mutex<State>>,
    app: &AppHandle<Wry>,
    status: PomodoroSessionStatus,
) -> Result<()> {
    use tauri::Manager;
    let (mode, started_at, round, running) = {
        let s = state_ptr.lock().await;
        (s.mode, s.phase_started_at, s.round, s.running)
    };
    if !running {
        return Ok(());
    }
    let Some(start_at) = started_at else {
        return Ok(());
    };
    let end_at = Utc::now();
    let kind = match mode {
        PomodoroMode::Focus => PomodoroSessionKind::Focus,
        _ => PomodoroSessionKind::Rest,
    };
    if let Some(state) = app.try_state::<crate::core::AppState>() {
        let db = state.db().clone();

        // 获取或创建活动 session（自动创建时不带备注）
        let active_session = pomo_service::get_or_create_active_session(&db, None).await?;

        // 创建 record 并关联到 session
        pomo_service::create_record_with_session(
            &db,
            active_session.id,
            kind,
            status,
            round,
            start_at,
            end_at,
            None,
        )
        .await?;

        // 发送会话记录更新事件
        println!("发送会话记录事件: {}", POMODORO_SESSION_RECORDED_EVENT);
        let _ = app.emit(POMODORO_SESSION_RECORDED_EVENT, ());
    }
    Ok(())
}

fn format_mode(mode: PomodoroMode) -> &'static str {
    match mode {
        PomodoroMode::Focus => "focus",
        PomodoroMode::ShortBreak => "short_break",
        PomodoroMode::LongBreak => "long_break",
        PomodoroMode::Idle => "idle",
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
async fn update_tray_tooltip(app: &AppHandle<Wry>, mode: PomodoroMode, remaining_seconds: u32) {
    let text = if matches!(mode, PomodoroMode::Idle) {
        "番茄钟 - 空闲".to_string()
    } else {
        let m = remaining_seconds / 60;
        let s = remaining_seconds % 60;
        let label = match mode {
            PomodoroMode::Focus => "专注",
            PomodoroMode::ShortBreak => "短休",
            PomodoroMode::LongBreak => "长休",
            PomodoroMode::Idle => "空闲",
        };
        format!("番茄钟 - {} {:02}:{:02}", label, m, s)
    };

    if let Some(state) = app.try_state::<crate::core::AppState>() {
        let _ = state.tray_manager().set_tooltip(app, &text);
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
async fn update_tray_tooltip(_app: &AppHandle<Wry>, _mode: PomodoroMode, _remaining_seconds: u32) {}
