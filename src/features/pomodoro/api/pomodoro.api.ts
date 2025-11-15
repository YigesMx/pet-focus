import { invoke } from "@tauri-apps/api/core"

export type PomodoroMode = "focus" | "short_break" | "long_break" | "idle"

export type PomodoroStatus = {
  running: boolean
  paused: boolean
  mode: PomodoroMode
  remainingSeconds: number
  round: number
}

export type PomodoroConfig = {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakInterval: number
}

export type PomodoroSession = {
  id: number
  kind: "focus" | "rest"
  status: "completed" | "stopped" | "skipped"
  round: number
  start_at: string
  end_at: string
  elapsed_seconds: number
  related_todo_id?: number | null
  created_at: string
  updated_at: string
}

export type PomodoroStats = {
  totalFocusSeconds: number
  sessionCount: number
}

export async function pomodoroStart(): Promise<PomodoroStatus> {
  return await invoke<PomodoroStatus>("pomodoro_start")
}

export async function pomodoroPause(): Promise<PomodoroStatus> {
  return await invoke<PomodoroStatus>("pomodoro_pause")
}

export async function pomodoroResume(): Promise<PomodoroStatus> {
  return await invoke<PomodoroStatus>("pomodoro_resume")
}

export async function pomodoroSkip(): Promise<PomodoroStatus> {
  return await invoke<PomodoroStatus>("pomodoro_skip")
}

export async function pomodoroStop(): Promise<PomodoroStatus> {
  return await invoke<PomodoroStatus>("pomodoro_stop")
}

export async function pomodoroStatus(): Promise<PomodoroStatus> {
  return await invoke<PomodoroStatus>("pomodoro_status")
}

export async function pomodoroGetConfig(): Promise<PomodoroConfig> {
  return await invoke<PomodoroConfig>("pomodoro_get_config")
}

export async function pomodoroSetConfig(config: PomodoroConfig): Promise<void> {
  await invoke("pomodoro_set_config", { config })
}

export async function listPomodoroSessions(limit = 50): Promise<PomodoroSession[]> {
  return await invoke<PomodoroSession[]>("pomodoro_list_sessions", { limit })
}

export async function deletePomodoroSession(sessionId: number): Promise<void> {
  await invoke("pomodoro_delete_session", { sessionId })
}

export async function getPomodoroStats(from: string, to: string): Promise<PomodoroStats> {
  return await invoke<PomodoroStats>("pomodoro_stats", { payload: { from, to } })
}
