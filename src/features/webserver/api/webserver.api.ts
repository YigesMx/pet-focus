import { invoke } from "@tauri-apps/api/core"

export type WebServerStatus = {
  running: boolean
  address?: string | null
  host?: string | null
  port?: number | null
}

export async function getWebServerStatus(): Promise<WebServerStatus> {
  return await invoke<WebServerStatus>("web_server_status")
}

export async function startWebServer(): Promise<WebServerStatus> {
  return await invoke<WebServerStatus>("start_web_server")
}

export async function stopWebServer(): Promise<WebServerStatus> {
  return await invoke<WebServerStatus>("stop_web_server")
}
