import { type ReactNode, useCallback, useMemo } from "react"
import { Loader2, Moon, Sun, MonitorCog } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ThemePreference } from "@/features/settings/api/theme.api"
import { setThemePreference } from "@/features/settings/api/theme.api"

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; description: string; icon: ReactNode }> = [
  {
    value: "light",
    label: "浅色模式",
    description: "在任意系统环境下保持明亮配色。",
    icon: <Sun className="size-4" aria-hidden="true" />,
  },
  {
    value: "dark",
    label: "深色模式",
    description: "在任意系统环境下保持暗色配色。",
    icon: <Moon className="size-4" aria-hidden="true" />,
  },
  {
    value: "system",
    label: "跟随系统",
    description: "根据当前操作系统主题自动切换。",
    icon: <MonitorCog className="size-4" aria-hidden="true" />,
  },
]

export function ThemePreferenceSelector() {
  const { theme, setTheme } = useTheme()

  const mutation = useMutation({
    mutationFn: setThemePreference,
  })

  const current = useMemo<ThemePreference>(() => {
    if (theme === "light" || theme === "dark" || theme === "system") {
      return theme
    }
    return "system"
  }, [theme])

  const handleChange = useCallback(
    (value: string) => {
      if (mutation.isPending) return
      if (value !== "light" && value !== "dark" && value !== "system") {
        toast.error("无法识别的主题设置")
        return
      }

      const previous = current

      setTheme(value)
      mutation.mutate(value, {
        onSuccess: () => {
          toast.success("主题设置已更新")
        },
        onError: (error) => {
          console.error(error)
          setTheme(previous)
          toast.error("更新主题设置失败")
        },
      })
    },
    [current, mutation, setTheme],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h4 className="text-base font-semibold">主题模式</h4>
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>
      <RadioGroup
        value={current}
        onValueChange={handleChange}
        className="grid gap-3 sm:grid-cols-3"
        aria-label="选择主题模式"
      >
        {THEME_OPTIONS.map((option) => (
          <label
            key={option.value}
            htmlFor={`theme-${option.value}`}
            className="border-input hover:border-ring hover:bg-accent group flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id={`theme-${option.value}`} value={option.value} />
              <span className="flex items-center gap-2 text-sm font-medium">
                {option.icon}
                {option.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}
