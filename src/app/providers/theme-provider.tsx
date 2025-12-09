import { ThemeProvider as NextThemesProvider } from "next-themes"
import { ColorThemeProvider } from "@/features/settings/providers/color-theme-provider"

type ThemeProviderProps = Parameters<typeof NextThemesProvider>[0]

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="class" disableTransitionOnChange enableSystem {...props}>
      <ColorThemeProvider>{children}</ColorThemeProvider>
    </NextThemesProvider>
  )
}
