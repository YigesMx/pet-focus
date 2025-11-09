import { invoke } from "@tauri-apps/api/core"

export type CalDavStatus = {
  configured: boolean
  url: string | null
  username: string | null
  last_sync_at: string | null
  last_error: string | null
  syncing: boolean
}

export type CalDavSyncOutcome =
  | {
      status: "success"
      synced_at: string
      created: number
      updated: number
      pushed: number
    }
  | {
      status: "skipped"
      reason: string
    }
  | {
      status: "error"
      message: string
    }

export type CalDavSyncEvent = {
  reason: "startup" | "manual" | "scheduled" | "data_changed" | "config_updated"
  outcome: CalDavSyncOutcome
}

export type CalDavConfigInput = {
  url: string
  username: string
  password: string
}

export async function getCaldavStatus(): Promise<CalDavStatus> {
  return await invoke<CalDavStatus>("get_caldav_status")
}

export async function saveCaldavConfig(payload: CalDavConfigInput): Promise<CalDavStatus> {
  return await invoke<CalDavStatus>("save_caldav_config", { payload })
}

export async function clearCaldavConfig(): Promise<CalDavStatus> {
  return await invoke<CalDavStatus>("clear_caldav_config")
}

export async function syncCaldavNow(): Promise<CalDavSyncEvent> {
  return await invoke<CalDavSyncEvent>("sync_caldav_now")
}

export async function getCaldavSyncInterval(): Promise<number> {
  return await invoke<number>("get_caldav_sync_interval")
}

export async function setCaldavSyncInterval(minutes: number): Promise<void> {
  return await invoke<void>("set_caldav_sync_interval", { minutes })
}

export const CALDAV_SYNC_EVENT = "caldav-sync-event" as const
