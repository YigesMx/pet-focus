import { type ReactNode, useState, useCallback, useEffect, useMemo } from "react"
import { useTheme } from "next-themes"
import {
  ColorThemeContext,
  getSavedColorThemeId,
  saveColorThemeId,
  applyColorTheme,
  getColorThemeById,
  DEFAULT_COLOR_THEME_ID,
} from "../hooks/useColorTheme"

interface ColorThemeProviderProps {
  children: ReactNode
}

export function ColorThemeProvider({ children }: ColorThemeProviderProps) {
  const { resolvedTheme } = useTheme()
  const [colorThemeId, setColorThemeIdState] = useState(getSavedColorThemeId)

  const colorTheme = useMemo(
    () => getColorThemeById(colorThemeId) ?? getColorThemeById(DEFAULT_COLOR_THEME_ID)!,
    [colorThemeId]
  )

  const setColorTheme = useCallback((id: string) => {
    const theme = getColorThemeById(id)
    if (!theme) return
    setColorThemeIdState(id)
    saveColorThemeId(id)
  }, [])

  // Apply theme when colorTheme or resolvedTheme changes
  useEffect(() => {
    const isDark = resolvedTheme === "dark"
    applyColorTheme(colorTheme, isDark)
  }, [colorTheme, resolvedTheme])

  const value = useMemo(
    () => ({ colorThemeId, colorTheme, setColorTheme }),
    [colorThemeId, colorTheme, setColorTheme]
  )

  return <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>
}
