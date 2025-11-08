import { invoke } from "@tauri-apps/api/core"

export type ThemePreference = "light" | "dark" | "system"

const isValidTheme = (value: string): value is ThemePreference => {
  return value === "light" || value === "dark" || value === "system"
}

export async function getThemePreference(): Promise<ThemePreference> {
  const result = await invoke<{ theme: string }>("get_theme_preference")
  if (isValidTheme(result.theme)) {
    return result.theme
  }
  return "system"
}

export async function setThemePreference(theme: ThemePreference): Promise<ThemePreference> {
  const result = await invoke<{ theme: string }>("set_theme_preference", { theme })
  if (isValidTheme(result.theme)) {
    return result.theme
  }
  return "system"
}

