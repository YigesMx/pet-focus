import { invoke } from "@tauri-apps/api/core"

import type { Todo } from "@/types/todo"

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
