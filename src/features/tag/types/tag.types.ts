// Tag 类型定义

export interface Tag {
  id: number
  name: string
  color: string | null
}

export interface CreateTagPayload {
  name: string
  color?: string
}

export interface UpdateTagPayload {
  id: number
  name?: string
  color?: string | null
}

export interface SetTaskTagsPayload {
  task_id: number
  tag_ids: number[]
}

export interface SetSessionTagsPayload {
  session_id: number
  tag_ids: number[]
}
