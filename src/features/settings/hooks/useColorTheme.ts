import { createContext, useContext } from "react"
import type { ColorTheme, ThemeStyles } from "../lib/color-themes"
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
  if (!ctx) throw new Error("useColorTheme must be used within ColorThemeProvider")
  return ctx
}

// Get saved theme id from localStorage
export function getSavedColorThemeId(): string {
  try {
    const saved = localStorage.getItem(COLOR_THEME_STORAGE_KEY)
    if (saved && getColorThemeById(saved)) return saved
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
const CSS_VAR_MAP: Record<keyof ThemeStyles, string> = {
  // Colors
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
  // Typography
  fontSans: "--font-sans",
  fontSerif: "--font-serif",
  fontMono: "--font-mono",
  // Layout
  radius: "--radius",
  spacing: "--spacing",
  letterSpacing: "--letter-spacing",
  // Shadows
  shadowColor: "--shadow-color",
  shadowOpacity: "--shadow-opacity",
  shadowBlur: "--shadow-blur",
  shadowSpread: "--shadow-spread",
  shadowOffsetX: "--shadow-offset-x",
  shadowOffsetY: "--shadow-offset-y",
}

// Apply theme styles to CSS variables
export function applyThemeStyles(styles: ThemeStyles, target: HTMLElement = document.documentElement): void {
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const value = styles[key as keyof ThemeStyles]
    target.style.setProperty(cssVar, value)
  }
}

// Apply color theme based on current mode
export function applyColorTheme(theme: ColorTheme, isDark: boolean): void {
  applyThemeStyles(isDark ? theme.dark : theme.light)
}

export { COLOR_THEMES, DEFAULT_COLOR_THEME_ID, getColorThemeById }
