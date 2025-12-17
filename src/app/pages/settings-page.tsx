import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CalDavSettings } from "@/features/caldav/components/caldav-settings"
import { ThemePreferenceSelector } from "@/features/settings/components/theme-preference"
import { ColorThemeSelector } from "@/features/settings/components/color-theme-selector"
import { CloseBehaviorSelector } from "@/features/settings/components/close-behavior-selector"
import { NotificationToggle } from "@/features/settings/components/notification-toggle"
import { DebugClearDataButton } from "@/features/settings/components/debug-settings"
import { ExternalApiToggle } from "@/features/webserver/components/external-api-toggle"
import { useWebServerControl } from "@/features/webserver/hooks/useWebServerControl"
import { PetControl } from "@/features/pet/components/pet-control"

export function SettingsPage() {
  const { isServerRunning, isServerBusy, isPlatformSupported, statusMessage, toggleApi } =
    useWebServerControl()

  return (
    <Card>
      <CardHeader>
        <CardTitle>设置</CardTitle>
        <CardDescription>管理应用程序的各项设置</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={["appearance", "pet"]} className="w-full">
          <AccordionItem value="appearance">
            <AccordionTrigger>
              <span className="text-base font-semibold">外观</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">自定义应用程序的外观和主题</p>
                <ColorThemeSelector />
                <ThemePreferenceSelector />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="behavior">
            <AccordionTrigger>
              <span className="text-base font-semibold">行为</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">自定义应用程序的行为方式</p>
                <CloseBehaviorSelector />
                <NotificationToggle />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="pet">
            <AccordionTrigger>
              <span className="text-base font-semibold">桌面宠物</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">控制桌面宠物的显示与隐藏</p>
                <PetControl />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="calendar">
            <AccordionTrigger>
              <span className="text-base font-semibold">日历同步</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">配置 CalDAV 日历同步设置</p>
                <CalDavSettings />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="debug">
            <AccordionTrigger>
              <span className="text-base font-semibold text-muted-foreground">调试选项</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">开发者调试功能，请谨慎使用</p>
                
                {/* 外部 API */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">外部 API 服务</div>
                  <ExternalApiToggle
                    isRunning={isServerRunning}
                    isBusy={isServerBusy}
                    isPlatformSupported={isPlatformSupported}
                    statusMessage={statusMessage}
                    onToggle={(nextEnabled) => {
                      void toggleApi(nextEnabled)
                    }}
                  />
                </div>
                
                {/* 清理数据 */}
                <DebugClearDataButton />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
