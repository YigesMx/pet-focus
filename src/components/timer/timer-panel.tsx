import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useTimerManager } from "@/features/timer/use-timer-manager"

function formatTime(totalSeconds: number) {
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
}

export function TimerPanel() {
  const {
    state,
    settings,
    pomodoroCount,
    isRunning,
    busy,
    start,
    pause,
    reset,
    saveSettings,
    savePomodoroCount,
    reload,
  } = useTimerManager()

  const [work, setWork] = useState<number>(settings?.work_duration ?? 0)
  const [shortBreak, setShortBreak] = useState<number>(settings?.short_break_duration ?? 0)
  const [longBreak, setLongBreak] = useState<number>(settings?.long_break_duration ?? 0)
  const [interval, setInterval] = useState<number>(settings?.long_break_interval ?? 4)

  useEffect(() => {
    if (settings) {
      setWork(settings.work_duration)
      setShortBreak(settings.short_break_duration)
      setLongBreak(settings.long_break_duration)
      setInterval(settings.long_break_interval)
    }
  }, [settings])

  const canSave = useMemo(() => {
    if (!settings) return false
    return (
      work !== settings.work_duration ||
      shortBreak !== settings.short_break_duration ||
      longBreak !== settings.long_break_duration ||
      interval !== settings.long_break_interval
    )
  }, [settings, work, shortBreak, longBreak, interval])

  return (
    <Card>
      <CardHeader>
        <CardTitle>番茄钟</CardTitle>
        <CardDescription>
          模式：{state?.mode ?? "-"} ｜ 番茄数：{pomodoroCount}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl font-mono tabular-nums">
            {formatTime(state?.remaining_time ?? 0)}
          </div>
          <div className="flex items-center gap-3">
            {isRunning ? (
              <Button onClick={() => void pause()} disabled={busy}>
                暂停
              </Button>
            ) : (
              <Button onClick={() => void start()} disabled={busy}>
                开始
              </Button>
            )}
            <Button variant="outline" onClick={() => void reset()} disabled={busy}>
              重置
            </Button>
            <Button
              variant="outline"
              onClick={() => void savePomodoroCount(0)}
              disabled={busy || pomodoroCount === 0}
            >
              清零番茄数
            </Button>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="work">工作时长（秒）</Label>
            <Input
              id="work"
              type="number"
              min={1}
              value={work}
              onChange={(e) => setWork(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="short">短休（秒）</Label>
            <Input
              id="short"
              type="number"
              min={1}
              value={shortBreak}
              onChange={(e) => setShortBreak(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="long">长休（秒）</Label>
            <Input
              id="long"
              type="number"
              min={1}
              value={longBreak}
              onChange={(e) => setLongBreak(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="interval">长休间隔（个番茄）</Label>
            <Input
              id="interval"
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={() =>
              void saveSettings({
                work_duration: work,
                short_break_duration: shortBreak,
                long_break_duration: longBreak,
                long_break_interval: interval,
              })
            }
            disabled={busy || !canSave}
          >
            保存设置
          </Button>
          <Button variant="ghost" onClick={() => void reload()} disabled={busy}>
            重新加载
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

