import { invoke } from "@tauri-apps/api/core"

export type CloseBehavior = "ask" | "minimize" | "quit"

const isValidCloseBehavior = (value: string): value is CloseBehavior => {
  return value === "ask" || value === "minimize" || value === "quit"
}

export async function getCloseBehavior(): Promise<CloseBehavior> {
  const result = await invoke<{ behavior: string }>("get_close_behavior")
  if (isValidCloseBehavior(result.behavior)) {
    return result.behavior
  }
  return "ask"
}

export async function setCloseBehavior(behavior: CloseBehavior): Promise<CloseBehavior> {
  const result = await invoke<{ behavior: string }>("set_close_behavior", { behavior })
  if (isValidCloseBehavior(result.behavior)) {
    return result.behavior
  }
  return "ask"
}

export async function quitApp(): Promise<void> {
  await invoke("quit_app")
}

export async function hideWindow(): Promise<void> {
  await invoke("hide_window")
}
