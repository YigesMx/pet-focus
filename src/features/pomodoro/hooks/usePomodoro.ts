import { useCallback, useEffect, useMemo, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import {
  pomodoroStart,
  pomodoroPause,
  pomodoroResume,
  pomodoroSkip,
  pomodoroStop,
  pomodoroStatus,
  type PomodoroStatus,
} from "@/features/pomodoro/api/pomodoro.api"

type UsePomodoroReturn = {
  status: PomodoroStatus | null
  isBusy: boolean
  start: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  skip: () => Promise<void>
  stop: () => Promise<void>
  display: {
    modeLabel: string
    timeText: string
  }
}

function formatTime(totalSeconds: number | undefined): string {
  const s = Math.max(0, totalSeconds ?? 0)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`
}

function modeToLabel(mode: PomodoroStatus["mode"] | undefined): string {
  switch (mode) {
    case "focus":
      return "专注"
    case "short_break":
      return "短休"
    case "long_break":
      return "长休"
    case "idle":
    default:
      return "空闲"
  }
}

export function usePomodoro(): UsePomodoroReturn {
  const [status, setStatus] = useState<PomodoroStatus | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  // bootstrap current status
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const s = await pomodoroStatus()
        if (mounted) setStatus(s)
      } catch {
        // ignore
      }
    })()

    // events
    const unlistenStatus = listen<PomodoroStatus>("pomodoro-status", (e) => {
      setStatus(e.payload)
    })
    const unlistenTick = listen<{ remainingSeconds: number }>("pomodoro-tick", (e) => {
      setStatus((prev) => (prev ? { ...prev, remainingSeconds: e.payload.remainingSeconds } : prev))
    })

    return () => {
      mounted = false
      void unlistenStatus.then((fn) => fn())
      void unlistenTick.then((fn) => fn())
    }
  }, [])

  const start = useCallback(async () => {
    setIsBusy(true)
    try {
      const s = await pomodoroStart()
      setStatus(s)
    } finally {
      setIsBusy(false)
    }
  }, [])

  const pause = useCallback(async () => {
    setIsBusy(true)
    try {
      const s = await pomodoroPause()
      setStatus(s)
    } finally {
      setIsBusy(false)
    }
  }, [])

  const resume = useCallback(async () => {
    setIsBusy(true)
    try {
      const s = await pomodoroResume()
      setStatus(s)
    } finally {
      setIsBusy(false)
    }
  }, [])

  const skip = useCallback(async () => {
    setIsBusy(true)
    try {
      const s = await pomodoroSkip()
      setStatus(s)
    } finally {
      setIsBusy(false)
    }
  }, [])

  const stop = useCallback(async () => {
    setIsBusy(true)
    try {
      const s = await pomodoroStop()
      setStatus(s)
    } finally {
      setIsBusy(false)
    }
  }, [])

  const display = useMemo(() => {
    return {
      modeLabel: modeToLabel(status?.mode),
      timeText: formatTime(status?.remainingSeconds),
    }
  }, [status])

  return { status, isBusy, start, pause, resume, skip, stop, display }
}

