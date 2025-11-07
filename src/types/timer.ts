export type TimerMode = "Work" | "ShortBreak" | "LongBreak"

export interface TimerState {
  remaining_time: number // seconds
  is_running: boolean
  mode: TimerMode
  pomodoro_count: number
  // settings mirrored in state
  work_duration: number
  short_break_duration: number
  long_break_duration: number
  long_break_interval: number
}

export interface PomodoroSettings {
  work_duration: number
  short_break_duration: number
  long_break_duration: number
  long_break_interval: number
}

export interface SetTimerSettingsPayload extends PomodoroSettings {}

