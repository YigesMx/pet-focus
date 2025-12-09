import { Check } from "lucide-react"
import { useColorTheme, COLOR_THEMES } from "../hooks/useColorTheme"

export function ColorThemeSelector() {
  const { colorThemeId, setColorTheme } = useColorTheme()

  return (
    <div className="space-y-4">
      <h4 className="text-base font-semibold">配色主题</h4>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {COLOR_THEMES.map((theme) => {
          const isSelected = theme.id === colorThemeId
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setColorTheme(theme.id)}
              className="group flex flex-col items-center gap-2"
              aria-label={`选择${theme.name}主题`}
              aria-pressed={isSelected}
            >
              <div
                className="relative size-10 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: theme.previewColor,
                  borderColor: isSelected ? theme.previewColor : "transparent",
                  boxShadow: isSelected ? `0 0 0 2px var(--background), 0 0 0 4px ${theme.previewColor}` : undefined,
                }}
              >
                {isSelected && (
                  <Check
                    className="absolute inset-0 m-auto size-5 text-white drop-shadow-sm"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                )}
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-foreground">
                {theme.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
