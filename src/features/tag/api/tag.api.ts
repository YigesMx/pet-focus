import { invoke } from "@tauri-apps/api/core"

import type {
  Tag,
  CreateTagPayload,
  UpdateTagPayload,
  SetTaskTagsPayload,
  SetSessionTagsPayload,
} from "../types"

// ========== Tag CRUD ==========

export async function getAllTags(): Promise<Tag[]> {
  return await invoke<Tag[]>("tag_get_all")
}

export async function createTag(payload: CreateTagPayload): Promise<Tag> {
  return await invoke<Tag>("tag_create", { payload })
}

export async function updateTag(payload: UpdateTagPayload): Promise<Tag> {
  return await invoke<Tag>("tag_update", { payload })
}

export async function deleteTag(id: number): Promise<void> {
  await invoke("tag_delete", { id })
}

// ========== Task Tags ==========

export async function getTagsForTask(taskId: number): Promise<Tag[]> {
  return await invoke<Tag[]>("tag_get_for_task", { taskId })
}

export async function setTagsForTask(payload: SetTaskTagsPayload): Promise<void> {
  await invoke("tag_set_for_task", { payload })
}

// ========== Session Tags ==========

export async function getTagsForSession(sessionId: number): Promise<Tag[]> {
  return await invoke<Tag[]>("tag_get_for_session", { sessionId })
}

export async function setTagsForSession(payload: SetSessionTagsPayload): Promise<void> {
  await invoke("tag_set_for_session", { payload })
}
