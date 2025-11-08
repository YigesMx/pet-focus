export interface Todo {
  id: number
  uid: string
  title: string
  description: string | null
  completed: boolean
  status: string
  percent_complete: number | null
  priority: number | null
  location: string | null
  tags: string[]
  start_at: string
  last_modified_at: string
  due_date: string | null
  recurrence_rule: string | null
  reminder_offset_minutes: number
  reminder_method: string | null
  timezone: string | null
  reminder_last_triggered_at: string | null
  completed_at: string | null
  notified: boolean
  dirty: boolean
  remote_url: string | null
  remote_etag: string | null
  remote_calendar_url: string | null
  sync_token: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export type TodoDetailUpdate = {
  description: string | null
  priority: number | null
  location: string | null
  tags: string[]
  start_at?: string | null
  due_date: string | null
  recurrence_rule: string | null
  reminder_offset_minutes: number | null
  reminder_method: string | null
  timezone: string | null
}
