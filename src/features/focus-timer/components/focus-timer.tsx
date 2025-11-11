import { useEffect, useState } from "react"
import { Pause, Play, Square, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface FocusTimerProps {
  todoId?: number | null
  todoTitle?: string
  onSessionComplete?: (duration: number, todoId: number, todoTitle: string) => void
  onCancel?: () => void
}

export function FocusTimer({ todoId, todoTitle, onSessionComplete, onCancel }: FocusTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  // 当接收到 todoId 时自动开始计时
  useEffect(() => {
    if (todoId && !isRunning) {
      setIsRunning(true)
    }
  }, [todoId])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning])

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60

  const handleToggle = () => {
    setIsRunning(!isRunning)
  }

  const handleStop = () => {
    setIsRunning(false)
  }

  const handleComplete = () => {
    setIsRunning(false)
    if (onSessionComplete && todoId && todoTitle) {
      onSessionComplete(elapsedSeconds, todoId, todoTitle)
    }
  }

  const handleCancel = () => {
    setIsRunning(false)
    if (onCancel) {
      onCancel()
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-2xl font-semibold">专注计时</CardTitle>
            <CardDescription>
              {todoTitle ? `任务: ${todoTitle}` : "无选中任务"}
            </CardDescription>
          </div>
          {onCancel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="text-muted-foreground"
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="py-8 text-center">
          <div className="text-7xl font-bold tabular-nums text-primary">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">已专注时间</p>
        </div>

        <div className="flex justify-center gap-3 pt-4">
          <Button
            size="lg"
            onClick={handleToggle}
            variant={isRunning ? "default" : "outline"}
            className="min-w-32 gap-2"
          >
            {isRunning ? (
              <>
                <Pause className="size-4" />
                暂停
              </>
            ) : (
              <>
                <Play className="size-4" />
                开始
              </>
            )}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleStop}
            disabled={!isRunning}
            className="min-w-32 gap-2"
          >
            <Square className="size-4" />
            停止
          </Button>
        </div>

        {elapsedSeconds > 0 && (
          <div className="pt-4">
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleComplete}
              variant="default"
            >
              完成任务并保存
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
