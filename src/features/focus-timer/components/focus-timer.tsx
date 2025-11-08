import { useEffect, useState } from "react"
import { Pause, Play, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface FocusTimerProps {
  initialDuration?: number
}

export function FocusTimer({ initialDuration = 25 * 60 }: FocusTimerProps) {
  const [totalSeconds] = useState(initialDuration)
  const [remainingSeconds, setRemainingSeconds] = useState(initialDuration)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    if (isRunning && remainingSeconds > 0) {
      interval = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, remainingSeconds])

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 100

  const handleToggle = () => {
    setIsRunning(!isRunning)
  }

  const handleReset = () => {
    setIsRunning(false)
    setRemainingSeconds(totalSeconds)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div>
          <CardTitle className="text-2xl font-semibold">番茄钟计时</CardTitle>
          <CardDescription>专注工作，提升效率</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="py-4 text-center">
          <div className="text-7xl font-bold tabular-nums text-primary">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={Math.max(0, Math.min(100, progress))} className="h-2" />
          <p className="text-center text-xs text-muted-foreground">{Math.round(progress)}% 已完成</p>
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <Button size="lg" onClick={handleToggle} variant={isRunning ? "default" : "outline"} className="min-w-24 gap-2">
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
          <Button size="lg" variant="outline" onClick={handleReset} className="min-w-24 gap-2">
            <RotateCcw className="size-4" />
            重置
          </Button>
        </div>

        {remainingSeconds === 0 && (
          <div className="mt-4 rounded-lg bg-green-50 p-4 text-center dark:bg-green-950">
            <p className="font-medium text-green-700 dark:text-green-300">✓ 太棒了！完成了一个番茄钟</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
