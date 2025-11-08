import { useCallback, useEffect, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"

import {
  CALDAV_SYNC_EVENT,
  clearCaldavConfig,
  getCaldavStatus,
  saveCaldavConfig,
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

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

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
        toast.success("CalDAV 配置已保存")
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
      toast.success("已清除 CalDAV 配置")
    } catch (error) {
      reportError("清除 CalDAV 配置失败", error)
    } finally {
      setIsClearing(false)
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (!status?.configured) {
      toast.error("请先保存 CalDAV 配置")
      return
    }

    setIsManualSyncing(true)
    setStatus((previous) => (previous ? { ...previous, syncing: true } : previous))

    try {
      const event = await syncCaldavNow()
      switch (event.outcome.status) {
        case "success":
          toast.success("已完成 CalDAV 同步")
          break
        case "skipped":
          toast.info("CalDAV 同步已跳过")
          break
        case "error":
          toast.error(event.outcome.message)
          break
      }
    } catch (error) {
      reportError("同步 CalDAV 数据失败", error)
    } finally {
      setIsManualSyncing(false)
      void loadStatus({ silent: true })
    }
  }, [status, loadStatus])

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
  }
}
