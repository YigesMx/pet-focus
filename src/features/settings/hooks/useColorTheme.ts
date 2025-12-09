import { createContext, useContext } from "react"
import type { ColorTheme, ThemeColors } from "../lib/color-themes"
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME_ID,
  COLOR_THEME_STORAGE_KEY,
  getColorThemeById,
} from "../lib/color-themes"

export interface ColorThemeContextValue {
  colorThemeId: string
  colorTheme: ColorTheme
  setColorTheme: (id: string) => void
}

export const ColorThemeContext = createContext<ColorThemeContextValue | null>(null)

export function useColorTheme(): ColorThemeContextValue {
  const ctx = useContext(ColorThemeContext)
  if (!ctx) {
    throw new Error("useColorTheme must be used within ColorThemeProvider")
  }
  return ctx
}

// Get saved theme id from localStorage
export function getSavedColorThemeId(): string {
  try {
    const saved = localStorage.getItem(COLOR_THEME_STORAGE_KEY)
    if (saved && getColorThemeById(saved)) {
      return saved
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_COLOR_THEME_ID
}

// Save theme id to localStorage
export function saveColorThemeId(id: string): void {
  try {
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, id)
  } catch {
    // localStorage not available
  }
}

// CSS variable name mapping
const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  destructiveForeground: "--destructive-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
  chart1: "--chart-1",
  chart2: "--chart-2",
  chart3: "--chart-3",
  chart4: "--chart-4",
  chart5: "--chart-5",
  sidebar: "--sidebar",
  sidebarForeground: "--sidebar-foreground",
  sidebarPrimary: "--sidebar-primary",
  sidebarPrimaryForeground: "--sidebar-primary-foreground",
  sidebarAccent: "--sidebar-accent",
  sidebarAccentForeground: "--sidebar-accent-foreground",
  sidebarBorder: "--sidebar-border",
  sidebarRing: "--sidebar-ring",
}

// Apply theme colors to CSS variables
export function applyThemeColors(colors: ThemeColors, target: HTMLElement = document.documentElement): void {
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const value = colors[key as keyof ThemeColors]
    target.style.setProperty(cssVar, value)
  }
}

// Apply color theme based on current mode (light/dark)
export function applyColorTheme(theme: ColorTheme, isDark: boolean): void {
  const colors = isDark ? theme.dark : theme.light
  applyThemeColors(colors)
}

// Check if current mode is dark
export function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark")
}

export { COLOR_THEMES, DEFAULT_COLOR_THEME_ID, getColorThemeById }
