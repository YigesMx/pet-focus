import { useCallback, useEffect, useState } from "react"
import { listen } from "@tauri-apps/api/event"

import {
  CALDAV_SYNC_EVENT,
  clearCaldavConfig,
  getCaldavStatus,
  getCaldavSyncInterval,
  saveCaldavConfig,
  setCaldavSyncInterval,
  syncCaldavNow,
  type CalDavConfigInput,
  type CalDavStatus,
  type CalDavSyncEvent,
} from "@/features/caldav/api/caldav.api"
import { reportError } from "@/shared/lib/report-error"

export function useCaldavSync() {
  const [status, setStatus] = useState<CalDavStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isManualSyncing, setIsManualSyncing] = useState(false)
  const [syncInterval, setSyncInterval] = useState<number>(15)
  const [isLoadingInterval, setIsLoadingInterval] = useState(true)
  const [isSavingInterval, setIsSavingInterval] = useState(false)

  const loadStatus = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true)
    }
    try {
      const data = await getCaldavStatus()
      setStatus(data)
    } catch (error) {
      reportError("加载 CalDAV 状态失败", error)
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }, [])

  const loadSyncInterval = useCallback(async () => {
    setIsLoadingInterval(true)
    try {
      const interval = await getCaldavSyncInterval()
      setSyncInterval(interval)
    } catch (error) {
      reportError("加载同步间隔失败", error)
    } finally {
      setIsLoadingInterval(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
    void loadSyncInterval()
  }, [loadStatus, loadSyncInterval])

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | null = null

    const setup = async () => {
      try {
        const off = await listen<CalDavSyncEvent>(CALDAV_SYNC_EVENT, async () => {
          if (disposed) return
          setIsManualSyncing(false)
          await loadStatus({ silent: true })
        })
        if (disposed) {
          off()
        } else {
          unlisten = off
        }
      } catch (error) {
        console.error("监听 CalDAV 同步事件失败", error)
      }
    }

    void setup()

    return () => {
      disposed = true
      if (unlisten) {
        unlisten()
      }
    }
  }, [loadStatus])

  const saveConfig = useCallback(
    async (payload: CalDavConfigInput) => {
      setIsSaving(true)
      try {
        const data = await saveCaldavConfig(payload)
        setStatus(data)
        // 后端已通过 NotificationManager 发送成功通知
      } catch (error) {
        reportError("保存 CalDAV 配置失败", error)
      } finally {
        setIsSaving(false)
      }
    },
    [],
  )

  const clearConfig = useCallback(async () => {
    setIsClearing(true)
    try {
      const data = await clearCaldavConfig()
      setStatus(data)
      // 后端已通过 NotificationManager 发送成功通知
    } catch (error) {
      reportError("清除 CalDAV 配置失败", error)
    } finally {
      setIsClearing(false)
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (!status?.configured) {
      console.warn("请先保存 CalDAV 配置")
      // 应该由后端返回错误并发送通知，这里只是客户端预检查
      return
    }

    setIsManualSyncing(true)
    setStatus((previous) => (previous ? { ...previous, syncing: true } : previous))

    try {
      const event = await syncCaldavNow()
      // 后端已通过 NotificationManager 发送相应的通知
      console.log(`[CalDAV Sync] ${event.outcome.status}`, event)
    } catch (error) {
      reportError("同步 CalDAV 数据失败", error)
    } finally {
      setIsManualSyncing(false)
      void loadStatus({ silent: true })
    }
  }, [status, loadStatus])

  const saveSyncInterval = useCallback(async (minutes: number) => {
    setIsSavingInterval(true)
    try {
      await setCaldavSyncInterval(minutes)
      setSyncInterval(minutes)
      // 后端已自动重启调度器
    } catch (error) {
      reportError("设置同步间隔失败", error)
    } finally {
      setIsSavingInterval(false)
    }
  }, [])

  const busySync = (status?.syncing ?? false) || isManualSyncing

  return {
    status,
    isLoading,
    isSaving,
    isClearing,
    isSyncing: busySync,
    saveConfig,
    clearConfig,
    syncNow,
    reload: loadStatus,
    syncInterval,
    isLoadingInterval,
    isSavingInterval,
    saveSyncInterval,
  }
}
