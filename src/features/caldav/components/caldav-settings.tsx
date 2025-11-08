import { useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Save, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCaldavSync } from "@/features/caldav/hooks/useCaldavSync"
import { formatDateTime } from "@/shared/lib/utils"

export function CalDavSettings() {
  const {
    status,
    isLoading,
    isSaving,
    isClearing,
    isSyncing,
    saveConfig,
    clearConfig,
    syncNow,
    reload,
  } = useCaldavSync()

  const [url, setUrl] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (status) {
      setUrl(status.url ?? "")
      setUsername(status.username ?? "")
      setPassword("")
    }
  }, [status])

  const isBusy = useMemo(() => isLoading || isSaving || isClearing, [isLoading, isSaving, isClearing])

  const lastSyncText = useMemo(() => {
    if (!status?.last_sync_at) return "尚未同步"
    return formatDateTime(status.last_sync_at)
  }, [status?.last_sync_at])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">CalDAV 同步</CardTitle>
        <CardDescription>配置 CalDAV 账户，并手动触发同步。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-2">
          <Label htmlFor="caldav-url">CalDAV 服务地址</Label>
          <Input
            id="caldav-url"
            placeholder="https://cal.example.com/calendars/user/todos"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={isBusy}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
          <div className="grid gap-2">
            <Label htmlFor="caldav-username">用户名</Label>
            <Input
              id="caldav-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isBusy}
              placeholder="user@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="caldav-password">密码 / 应用专用密码</Label>
            <Input
              id="caldav-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isBusy}
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="grid gap-1 text-sm text-muted-foreground">
          <span>
            上次同步时间：<strong className="text-foreground">{lastSyncText}</strong>
          </span>
          {status?.last_error ? <span className="text-destructive">最近错误：{status.last_error}</span> : null}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setPassword("")
              void reload()
            }}
            variant="ghost"
            type="button"
            disabled={isBusy}
          >
            刷新状态
          </Button>
          <Button
            onClick={() => {
              void clearConfig()
            }}
            type="button"
            variant="destructive"
            disabled={isBusy || !status?.configured}
          >
            {isClearing ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="mr-2 size-4" aria-hidden="true" />
            )}
            清除配置
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button
            onClick={() => {
              void syncNow()
            }}
            type="button"
            variant="outline"
            disabled={isBusy || isSyncing || !status?.configured}
          >
            {isSyncing ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            )}
            手动同步
          </Button>
          <Button
            onClick={() => {
              void saveConfig({ url, username, password })
            }}
            type="button"
            disabled={isBusy || !url.trim() || !username.trim() || !password.trim()}
          >
            {isSaving ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="mr-2 size-4" aria-hidden="true" />
            )}
            保存配置
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
