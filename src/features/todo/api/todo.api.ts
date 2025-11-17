import { invoke } from "@tauri-apps/api/core"

import type { Todo, TodoDetailUpdate } from "@/features/todo/types/todo.types"

type UpdatePayload = {
  title?: string
  completed?: boolean
}

export async function listTodos(): Promise<Todo[]> {
  return await invoke<Todo[]>("list_todos")
}

export async function createTodo(title?: string): Promise<Todo> {
  const payload = title === undefined ? undefined : { title }
  return await invoke<Todo>("create_todo", { payload })
}

export async function updateTodo(
  id: number,
  changes: UpdatePayload,
): Promise<Todo> {
  const payload: { id: number; title?: string; completed?: boolean } = { id }
  if (typeof changes.title === "string") {
    payload.title = changes.title
  }
  if (typeof changes.completed === "boolean") {
    payload.completed = changes.completed
  }

  return await invoke<Todo>("update_todo", { payload })
}

export async function deleteTodo(id: number): Promise<void> {
  await invoke("delete_todo", { id })
}

export async function updateTodoDetails(
  id: number,
  details: TodoDetailUpdate,
): Promise<Todo> {
  const payload = {
    id,
    description: details.description,
    priority: details.priority,
    location: details.location,
    tags: details.tags,
    start_at: details.start_at,
    due_date: details.due_date,
    recurrence_rule: details.recurrence_rule,
    reminder_offset_minutes: details.reminder_offset_minutes,
    reminder_method: details.reminder_method,
    timezone: details.timezone,
  }

  return await invoke<Todo>("update_todo_details", { payload })
}

export async function updateTodoParent(
  id: number,
  parentId: number | null,
): Promise<Todo> {
  return await invoke<Todo>("update_todo_parent", { id, parentId })
}
