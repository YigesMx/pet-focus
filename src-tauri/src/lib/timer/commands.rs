use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;

// 从 state 模块导入
// use crate::state::{AppState, TimerMode, TimerState};
use crate::AppState; // <--- 使用根 AppState
use super::state::{TimerMode, TimerState};

// --- 计时器控制命令 ---

#[tauri::command]
pub fn start_timer(app: AppHandle, state: State<'_, AppState>) {

    let mut state_guard = state.timer().lock().unwrap();

    if state_guard.is_running {
        return; // 已经在运行
    }
    state_guard.is_running = true;

    // 克隆线程需要的数据
    let remaining = state_guard.remaining_time;

    // 在启动线程前释放锁!
    drop(state_guard);

    // 修复 E0521: 克隆 Arc<Mutex<TimerState>> (即 state.timer())
    // 我们不能将 'state' (State<'_>) 移入线程，因为它生命周期太短。
    // 但我们可以克隆它内部的 Arc (state.timer())，Arc 是 'static 的，可以安全移入。
    let state_clone = state.timer().clone();

    // 启动一个新线程来处理计时器
    // 'move' 会将 state_clone 和 app 移入新线程
    thread::spawn(move || {
        let mut current_remaining = remaining;

        while current_remaining > 0 {
            // 1. 检查是否被暂停
            // 每次循环都获取锁，检查状态，然后立即释放
            let state_check = state_clone.lock().unwrap();
            if !state_check.is_running {
                // 已暂停, 停止此线程
                break;
            }
            drop(state_check); // 释放锁

            // 2. 睡眠
            thread::sleep(Duration::from_secs(1));
            current_remaining -= 1;

            // 3. 更新状态并发送事件
            // 再次获取锁以安全地修改状态
            let mut state_guard = state_clone.lock().unwrap();
            state_guard.remaining_time = current_remaining;

            // 修复 Panic: 使用 'if let Err' 避免 .unwrap() 导致线程崩溃
            if let Err(e) = app.emit("time_update", state_guard.clone()) {
                println!("Failed to emit time_update: {}", e);
            }

            // 4. 检查是否完成
            if current_remaining == 0 {
                // 计时器完成, 处理模式切换
                handle_timer_finish(&app, &mut state_guard);
            }

            // 循环结束前释放锁
            drop(state_guard);
        }
    });
}

#[tauri::command]
pub fn pause_timer(state: State<'_, AppState>) {
    let mut state_guard = state.timer().lock().unwrap();
    state_guard.is_running = false;
    // 线程将在下一次循环检查时停止
}

#[tauri::command]
pub fn reset_timer(app: AppHandle, state: State<'_, AppState>) {
    let mut state_guard = state.timer().lock().unwrap();
    state_guard.is_running = false;

    // 根据当前模式重置时间
    state_guard.remaining_time = match state_guard.mode {
        TimerMode::Work => state_guard.work_duration,
        TimerMode::ShortBreak => state_guard.short_break_duration,
        TimerMode::LongBreak => state_guard.long_break_duration,
    };

    // 修复 Panic: 使用 'if let Err' 避免 .unwrap()
    if let Err(e) = app.emit("time_update", state_guard.clone()) {
        println!("Failed to emit time_update on reset: {}", e);
    }
}

// --- 状态/设置 命令 ---

#[tauri::command]
pub fn get_initial_state(state: State<'_, AppState>) -> TimerState {
    // 返回当前状态的克隆
    state.timer().lock().unwrap().clone()
}

fn handle_timer_finish(app: &AppHandle, state: &mut std::sync::MutexGuard<'_, TimerState>) {
    state.is_running = false;
    let notification_title = "时间到!".to_string();
    let mut notification_body = "".to_string();

    match state.mode {
        TimerMode::Work => {
            state.pomodoro_count += 1;
            if state.pomodoro_count % state.long_break_interval == 0 {
                state.mode = TimerMode::LongBreak;
                state.remaining_time = state.long_break_duration;
                notification_body = "开始长休息吧！ (15 分钟)".to_string();
            } else {
                state.mode = TimerMode::ShortBreak;
                state.remaining_time = state.short_break_duration;
                notification_body = "开始短休息吧！ (5 分钟)".to_string();
            }
        }
        TimerMode::ShortBreak | TimerMode::LongBreak => {
            state.mode = TimerMode::Work;
            state.remaining_time = state.work_duration;
            notification_body = "开始工作吧！ (25 分钟)".to_string();
        }
    }

    if let Err(e) = app
        .notification()
        .builder()
        .title(&notification_title)
        .body(&notification_body)
        .show()
    {
        println!("Failed to show notification: {}", e);
    }

    // 修复 Panic: 使用 'if let Err' 避免 .unwrap()
    // 发送模式变更事件 (也包含新状态)
    if let Err(e) = app.emit("mode_changed", state.clone()) {
        println!("Failed to emit mode_changed: {}", e);
    }
}

