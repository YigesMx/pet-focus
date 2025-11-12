import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Play, Pause, Square, Coffee, RotateCcw } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

type Phase = "idle" | "focus" | "rest" | "done"

function formatTime(total: number): string {
  const s = Math.max(0, total)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`
}

export function ForestTimer() {
  // configurable durations (minutes)
  const [focusMinutes, setFocusMinutes] = useState<number>(25)
  const [restMinutes, setRestMinutes] = useState<number>(5)

  // runtime state
  const [phase, setPhase] = useState<Phase>("idle")
  const [remaining, setRemaining] = useState<number>(0)
  const [running, setRunning] = useState<boolean>(false)
  const intervalRef = useRef<number | null>(null)

  const startFocus = useCallback(() => {
    setPhase("focus")
    setRemaining(Math.max(1, Math.round(focusMinutes)) * 60)
    setRunning(true)
  }, [focusMinutes])

  const startRest = useCallback(() => {
    setPhase("rest")
    setRemaining(Math.max(1, Math.round(restMinutes)) * 60)
    setRunning(true)
  }, [restMinutes])

  const stopAll = useCallback(() => {
    setRunning(false)
    setPhase("idle")
    setRemaining(0)
  }, [])

  const toggle = useCallback(() => {
    setRunning((v) => !v)
  }, [])

  // ticking
  useEffect(() => {
    if (!running) return
    intervalRef.current = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalRef.current ?? undefined)
          intervalRef.current = null
          // focus → prompt rest; rest → done
          setRunning(false)
          setPhase((p) => (p === "focus" ? "rest" : p === "rest" ? "done" : p))
          return 0
        }
        return prev - 1
      })
    }, 1000) as unknown as number
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [running])

  const title = useMemo(() => {
    switch (phase) {
      case "focus":
        return "专注中"
      case "rest":
        return "休息中"
      case "done":
        return "已完成"
      default:
        return "准备专注"
    }
  }, [phase])

  const description = useMemo(() => {
    switch (phase) {
      case "focus":
        return "保持专注，勿扰当前任务"
      case "rest":
        return "放松片刻，稍后继续"
      case "done":
        return "本次专注已完成"
      default:
        return "像 Forest 一样，先设定本次时长"
    }
  }, [phase])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">专注</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="py-8 text-center">
          <div className="text-7xl font-bold tabular-nums text-primary">{formatTime(remaining)}</div>
          {phase === "idle" && <p className="mt-2 text-sm text-muted-foreground">等待开始</p>}
          {phase === "focus" && <p className="mt-2 text-sm text-muted-foreground">专注进行中</p>}
          {phase === "rest" && <p className="mt-2 text-sm text-muted-foreground">休息进行中</p>}
          {phase === "done" && <p className="mt-2 text-sm text-muted-foreground">恭喜完成</p>}
        </div>

        {/* Focus duration control (only when idle) */}
        {phase === "idle" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">专注时长</span>
              <span className="text-sm font-medium">{Math.round(focusMinutes)} 分钟</span>
            </div>
            <Slider
              value={[focusMinutes]}
              min={5}
              max={180}
              step={1}
              onValueChange={(v) => setFocusMinutes(v[0])}
            />
          </div>
        )}

        {/* Rest duration control (after focus finishes, before rest starts or when rest done) */}
        {(phase === "rest" && !running) || phase === "done" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">休息时长</span>
              <span className="text-sm font-medium">{Math.round(restMinutes)} 分钟</span>
            </div>
            <Slider
              value={[restMinutes]}
              min={1}
              max={60}
              step={1}
              onValueChange={(v) => setRestMinutes(v[0])}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {phase === "idle" && (
            <Button className="min-w-32 gap-2" onClick={startFocus}>
              <Play className="size-4" /> 开始专注
            </Button>
          )}

          {(phase === "focus" || phase === "rest") && (
            <>
              <Button variant="outline" className="min-w-28 gap-2" onClick={toggle}>
                {running ? (
                  <>
                    <Pause className="size-4" /> 暂停
                  </>
                ) : (
                  <>
                    <Play className="size-4" /> 继续
                  </>
                )}
              </Button>
              <Button variant="outline" className="min-w-28 gap-2" onClick={stopAll}>
                <Square className="size-4" /> 停止
              </Button>
            </>
          )}

          {phase === "rest" && !running && (
            <Button className="min-w-32 gap-2" onClick={startRest}>
              <Coffee className="size-4" /> 开始休息
            </Button>
          )}

          {phase === "done" && (
            <Button variant="ghost" className="min-w-32 gap-2" onClick={startFocus}>
              <RotateCcw className="size-4" /> 再来一次
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

