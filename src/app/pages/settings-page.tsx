import { Card, CardContent } from "@/components/ui/card"
import { CalDavSettings } from "@/features/caldav/components/caldav-settings"
import { ThemePreferenceSelector } from "@/features/settings/components/theme-preference"
import { ExternalApiToggle } from "@/features/webserver/components/external-api-toggle"
import { useWebServerControl } from "@/features/webserver/hooks/useWebServerControl"

export function SettingsPage() {
  const { isServerRunning, isServerBusy, isPlatformSupported, statusMessage, toggleApi } =
    useWebServerControl()

  return (
    <Card>
      <CardContent className="space-y-6 py-6">
        <section>
          <h3 className="mb-4 text-lg font-semibold">外观</h3>
          <ThemePreferenceSelector />
        </section>

        <section>
          <h3 className="mb-4 text-lg font-semibold">日历同步</h3>
          <CalDavSettings />
        </section>

        <section>
          <h3 className="mb-4 text-lg font-semibold">外部 API</h3>
          <ExternalApiToggle
            isRunning={isServerRunning}
            isBusy={isServerBusy}
            isPlatformSupported={isPlatformSupported}
            statusMessage={statusMessage}
            onToggle={(nextEnabled) => {
              void toggleApi(nextEnabled)
            }}
          />
        </section>
      </CardContent>
    </Card>
  )
}
