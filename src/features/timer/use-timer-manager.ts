import { useCallback, useEffect, useMemo, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"

import {
  getInitialTimerState,
  getPomodoroCount,
  getTimerSettings,
  pauseTimer,
  resetTimer,
  setPomodoroCount,
  setTimerSettings,
  startTimer,
} from "@/lib/timer-api"
import type { PomodoroSettings, TimerState } from "@/types/timer"
import { reportError } from "@/lib/report-error"

type TimerSettingsChangedEvent = PomodoroSettings

export function useTimerManager() {
  const [state, setState] = useState<TimerState | null>(null)
  const [settings, setSettings] = useState<PomodoroSettings | null>(null)
  const [pomodoroCount, setCount] = useState<number>(0)
  const [busy, setBusy] = useState<boolean>(false)

  const loadAll = useCallback(async () => {
    try {
      const [s, cfg, count] = await Promise.all([
        getInitialTimerState(),
        getTimerSettings(),
        getPomodoroCount(),
      ])
      setState(s)
      setSettings(cfg)
      setCount(count)
    } catch (error) {
      reportError("加载计时器数据失败", error)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // runtime updates
  useEffect(() => {
    let disposed = false
    let unlistenTime: (() => void) | null = null
    let unlistenMode: (() => void) | null = null
    let unlistenSettings: (() => void) | null = null
    let unlistenCount: (() => void) | null = null

    const setup = async () => {
      try {
        const un1 = await listen<TimerState>("time_update", (event) => {
          if (disposed) return
          setState(event.payload)
        })
        const un2 = await listen<TimerState>("mode_changed", (event) => {
          if (disposed) return
          setState(event.payload)
          toast.message("番茄钟模式已切换")
        })
        const un3 = await listen<TimerSettingsChangedEvent>(
          "timer-settings-changed",
          (event) => {
            if (disposed) return
            setSettings(event.payload)
            toast.success("计时器设置已更新")
          },
        )
        const un4 = await listen<number>("pomodoro-count-changed", (event) => {
          if (disposed) return
          setCount(event.payload)
        })

        if (disposed) {
          un1()
          un2()
          un3()
          un4()
        } else {
          unlistenTime = un1
          unlistenMode = un2
          unlistenSettings = un3
          unlistenCount = un4
        }
      } catch (error) {
        console.error("监听计时器事件失败", error)
      }
    }

    void setup()

    return () => {
      disposed = true
      unlistenTime?.()
      unlistenMode?.()
      unlistenSettings?.()
      unlistenCount?.()
    }
  }, [])

  const start = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await startTimer()
    } catch (error) {
      reportError("开始计时失败", error)
    } finally {
      setBusy(false)
    }
  }, [busy])

  const pause = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await pauseTimer()
    } catch (error) {
      reportError("暂停计时失败", error)
    } finally {
      setBusy(false)
    }
  }, [busy])

  const reset = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await resetTimer()
    } catch (error) {
      reportError("重置计时失败", error)
    } finally {
      setBusy(false)
    }
  }, [busy])

  const saveSettings = useCallback(
    async (next: PomodoroSettings) => {
      if (busy) return
      setBusy(true)
      try {
        const saved = await setTimerSettings(next)
        setSettings(saved)
      } catch (error) {
        reportError("保存计时器设置失败", error)
      } finally {
        setBusy(false)
      }
    },
    [busy],
  )

  const savePomodoroCount = useCallback(
    async (count: number) => {
      try {
        await setPomodoroCount(count)
        setCount(count)
      } catch (error) {
        reportError("保存番茄数量失败", error)
      }
    },
    [],
  )

  const isRunning = state?.is_running ?? false
  const memoState = useMemo(() => state, [state])
  const memoSettings = useMemo(() => settings, [settings])

  return {
    state: memoState,
    settings: memoSettings,
    pomodoroCount,
    isRunning,
    busy,
    // actions
    start,
    pause,
    reset,
    saveSettings,
    savePomodoroCount,
    reload: loadAll,
  }
}

