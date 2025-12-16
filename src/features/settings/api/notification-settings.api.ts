import { invoke } from "@tauri-apps/api/core"

export interface NotificationSettings {
  enabled: boolean
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  return await invoke<NotificationSettings>("get_notification_settings")
}

export async function setNotificationSettings(enabled: boolean): Promise<NotificationSettings> {
  return await invoke<NotificationSettings>("set_notification_settings", { enabled })
}
