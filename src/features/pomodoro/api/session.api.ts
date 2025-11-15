import { invoke } from "@tauri-apps/api/core";

// ==================== Types ====================

export interface PomodoroSession {
  id: number;
  note: string | null;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PomodoroRecord {
  id: number;
  kind: "focus" | "rest";
  status: "completed" | "stopped" | "skipped";
  round: number;
  start_at: string;
  end_at: string;
  elapsed_seconds: number;
  related_todo_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AdjustedTimes {
  focusMinutes: number | null;
  restMinutes: number | null;
}

// ==================== Session Management API ====================

/**
 * 创建新的 Session
 */
export async function createSession(note?: string): Promise<PomodoroSession> {
  return await invoke<PomodoroSession>("pomodoro_create_session", { note });
}

/**
 * 获取指定 Session
 */
export async function getSession(sessionId: number): Promise<PomodoroSession | null> {
  return await invoke<PomodoroSession | null>("pomodoro_get_session", { sessionId });
}

/**
 * 获取所有 Sessions
 */
export async function listAllSessions(includeArchived = false): Promise<PomodoroSession[]> {
  return await invoke<PomodoroSession[]>("pomodoro_list_all_sessions", { includeArchived });
}

/**
 * 更新 Session 备注
 */
export async function updateSessionNote(sessionId: number, note: string | null): Promise<PomodoroSession> {
  return await invoke<PomodoroSession>("pomodoro_update_session_note", { sessionId, note });
}

/**
 * 归档 Session
 */
export async function archiveSession(sessionId: number): Promise<PomodoroSession> {
  return await invoke<PomodoroSession>("pomodoro_archive_session", { sessionId });
}

/**
 * 删除 Session（级联删除关联记录）
 */
export async function deleteSessionCascade(sessionId: number): Promise<void> {
  return await invoke<void>("pomodoro_delete_session_cascade", { sessionId });
}

/**
 * 获取活动 Session（不自动创建）
 */
export async function getActiveSession(): Promise<PomodoroSession | null> {
  return await invoke<PomodoroSession | null>("pomodoro_get_active_session");
}

/**
 * 获取或创建活动 Session
 * @param pendingNote 如果需要创建新 session，使用此备注
 */
export async function getOrCreateActiveSession(pendingNote?: string | null): Promise<PomodoroSession> {
  return await invoke<PomodoroSession>("pomodoro_get_or_create_active_session", { 
    pendingNote: pendingNote || null 
  });
}

/**
 * 获取 Session 的所有 Records
 */
export async function listSessionRecords(sessionId: number): Promise<PomodoroRecord[]> {
  return await invoke<PomodoroRecord[]>("pomodoro_list_session_records", { sessionId });
}

/**
 * 生成 Session 动态标题
 */
export async function generateSessionTitle(sessionId: number): Promise<string> {
  return await invoke<string>("pomodoro_generate_session_title", { sessionId });
}

// ==================== Time Adjustment API ====================

/**
 * 保存上次调整的时间配置
 */
export async function saveAdjustedTimes(focusMinutes?: number, restMinutes?: number): Promise<void> {
  return await invoke<void>("pomodoro_save_adjusted_times", {
    payload: {
      focusMinutes: focusMinutes ?? null,
      restMinutes: restMinutes ?? null,
    },
  });
}

/**
 * 获取上次调整的时间配置
 */
export async function getAdjustedTimes(): Promise<AdjustedTimes> {
  return await invoke<AdjustedTimes>("pomodoro_get_adjusted_times");
}
