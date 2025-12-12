import { invoke } from "@tauri-apps/api/core"

import type { SessionTodoLink } from "../types/session-todo-link.types"

// ==================== Session-Todo Link API ====================

/**
 * 获取 Session 关联的所有 Todo IDs
 */
export async function listSessionTodoLinks(sessionId: number): Promise<SessionTodoLink[]> {
  return await invoke<SessionTodoLink[]>("session_todo_link_list", { sessionId })
}

/**
 * 添加 Session-Todo 关联
 */
export async function addSessionTodoLink(sessionId: number, todoId: number): Promise<SessionTodoLink> {
  return await invoke<SessionTodoLink>("session_todo_link_add", { sessionId, todoId })
}

/**
 * 移除 Session-Todo 关联
 */
export async function removeSessionTodoLink(sessionId: number, todoId: number): Promise<void> {
  await invoke("session_todo_link_remove", { sessionId, todoId })
}

/**
 * 重排序 Session-Todo 关联
 */
export async function reorderSessionTodoLinks(sessionId: number, todoIds: number[]): Promise<void> {
  await invoke("session_todo_link_reorder", { sessionId, todoIds })
}
