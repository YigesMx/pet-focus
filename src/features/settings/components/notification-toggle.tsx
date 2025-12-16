import { useCallback, useState, useEffect } from "react"
import { Loader2, Bell, BellOff } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  getNotificationSettings,
  setNotificationSettings,
} from "@/features/settings/api/notification-settings.api"

export function NotificationToggle() {
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: getNotificationSettings,
  })

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled)
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: setNotificationSettings,
    onSuccess: (result) => {
      queryClient.setQueryData(["notification-settings"], result)
    },
  })

  const handleToggle = useCallback(
    (checked: boolean | "indeterminate") => {
      if (mutation.isPending) return
      if (checked === "indeterminate") return

      const previous = enabled
      setEnabled(checked)

      mutation.mutate(checked, {
        onError: (error) => {
          console.error(error)
          setEnabled(previous)
        },
      })
    },
    [enabled, mutation],
  )

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h4 className="text-base font-semibold">系统通知</h4>
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>

      <label
        htmlFor="notification-toggle"
        className="flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
      >
        <div className="flex items-center gap-3">
          {enabled ? (
            <Bell className="size-5 text-primary" />
          ) : (
            <BellOff className="size-5 text-muted-foreground" />
          )}
          <div className="space-y-0.5">
            <Label htmlFor="notification-toggle" className="cursor-pointer text-sm font-medium">
              启用系统通知
            </Label>
            <p className="text-xs text-muted-foreground">
              {enabled ? "专注结束、休息提醒等会通过系统通知提示" : "已关闭系统通知"}
            </p>
          </div>
        </div>
        <Checkbox
          id="notification-toggle"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={mutation.isPending}
        />
      </label>
    </div>
  )
}
