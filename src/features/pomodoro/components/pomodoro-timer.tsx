import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Pause, Play, RotateCcw, SkipForward, Square } from "lucide-react"
import { usePomodoro } from "@/features/pomodoro/hooks/usePomodoro"

export function PomodoroTimer() {
  const { status, isBusy, start, pause, resume, skip, stop, display } = usePomodoro()

  const isRunning = status?.running ?? false
  const isPaused = status?.paused ?? false

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">番茄钟</CardTitle>
        <CardDescription>
          {display.modeLabel} {isRunning ? (isPaused ? "(已暂停)" : "进行中") : "(空闲)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="py-8 text-center">
          <div className="text-7xl font-bold tabular-nums text-primary">{display.timeText}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {status ? `第 ${status.round || 0} 轮` : "尚未开始"}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {!isRunning ? (
            <Button size="lg" className="min-w-32 gap-2" onClick={() => start()} disabled={isBusy}>
              <Play className="size-4" /> 开始
            </Button>
          ) : isPaused ? (
            <Button size="lg" className="min-w-32 gap-2" onClick={() => resume()} disabled={isBusy}>
              <Play className="size-4" /> 继续
            </Button>
          ) : (
            <Button size="lg" className="min-w-32 gap-2" onClick={() => pause()} disabled={isBusy}>
              <Pause className="size-4" /> 暂停
            </Button>
          )}

          <Button size="lg" variant="outline" className="min-w-32 gap-2" onClick={() => skip()} disabled={!isRunning || isBusy}>
            <SkipForward className="size-4" /> 跳过
          </Button>

          <Button size="lg" variant="outline" className="min-w-32 gap-2" onClick={() => stop()} disabled={!isRunning || isBusy}>
            <Square className="size-4" /> 停止
          </Button>

          <Button size="lg" variant="ghost" className="min-w-32 gap-2" onClick={() => start()} disabled={isBusy}>
            <RotateCcw className="size-4" /> 重置并开始
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

