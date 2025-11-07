import { invoke } from "@tauri-apps/api/core"

import type {
  PomodoroSettings,
  SetTimerSettingsPayload,
  TimerState,
} from "@/types/timer"

export async function startTimer(): Promise<void> {
  await invoke("start_timer")
}

export async function pauseTimer(): Promise<void> {
  await invoke("pause_timer")
}

export async function resetTimer(): Promise<void> {
  await invoke("reset_timer")
}

export async function getInitialTimerState(): Promise<TimerState> {
  return await invoke<TimerState>("get_initial_state")
}

export async function getTimerSettings(): Promise<PomodoroSettings> {
  return await invoke<PomodoroSettings>("get_timer_settings")
}

export async function setTimerSettings(
  payload: SetTimerSettingsPayload,
): Promise<PomodoroSettings> {
  return await invoke<PomodoroSettings>("set_timer_settings", { payload })
}

export async function getPomodoroCount(): Promise<number> {
  return await invoke<number>("get_pomodoro_count")
}

export async function setPomodoroCount(count: number): Promise<void> {
  await invoke("set_pomodoro_count", { count })
}

