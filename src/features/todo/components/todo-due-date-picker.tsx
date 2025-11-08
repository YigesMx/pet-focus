import { type MouseEvent, useEffect, useState } from "react"
import { Calendar as CalendarIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/shared/lib/utils"

interface TodoDueDatePickerProps {
  value: string | null
  onChange: (value: string | null) => void
  reminderOffsetMinutes?: number
  onReminderOffsetChange?: (minutes: number) => void
  isNotified?: boolean
  isCompleted?: boolean
  disabled?: boolean
}

export function TodoDueDatePicker({
  value,
  onChange,
  reminderOffsetMinutes = 15,
  onReminderOffsetChange,
  isNotified = false,
  isCompleted = false,
  disabled = false,
}: TodoDueDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [tempDate, setTempDate] = useState<Date | undefined>(
    value ? new Date(value) : undefined,
  )
  const [tempTime, setTempTime] = useState<string>(
    value ? new Date(value).toTimeString().slice(0, 5) : "23:59",
  )
  const [tempReminderOffset, setTempReminderOffset] = useState<number>(
    reminderOffsetMinutes,
  )

  useEffect(() => {
    if (value) {
      const next = new Date(value)
      setTempDate(next)
      setTempTime(next.toTimeString().slice(0, 5))
    } else {
      setTempDate(undefined)
      setTempTime("23:59")
    }
  }, [value])

  useEffect(() => {
    setTempReminderOffset(reminderOffsetMinutes)
  }, [reminderOffsetMinutes])

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      if (value) {
        const next = new Date(value)
        setTempDate(next)
        setTempTime(next.toTimeString().slice(0, 5))
      } else {
        setTempDate(undefined)
        setTempTime("23:59")
      }
      setTempReminderOffset(reminderOffsetMinutes)
    }
    setOpen(isOpen)
  }

  const handleConfirm = () => {
    if (tempDate) {
      const [hours, minutes] = tempTime.split(":")
      const finalDate = new Date(tempDate)
      finalDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
      onChange(finalDate.toISOString())
    } else {
      onChange(null)
    }

    if (onReminderOffsetChange && tempReminderOffset !== reminderOffsetMinutes) {
      onReminderOffsetChange(tempReminderOffset)
    }

    setOpen(false)
  }

  const handleClear = (event: MouseEvent) => {
    event.stopPropagation()
    onChange(null)
  }

  const formatDateTime = (dateValue: string | null) => {
    if (!dateValue) return ""
    const date = new Date(dateValue)
    const localDate = date.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    })
    const localTime = date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    return `${localDate} ${localTime}`
  }

  return (
    <div className="flex items-center gap-2">
      {value && (
        <span
          className={cn(
            "text-sm",
            isNotified && !isCompleted
              ? "text-destructive font-medium"
              : "text-muted-foreground",
          )}
        >
          到期: {formatDateTime(value)}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "size-8 text-muted-foreground hover:text-foreground",
          value && !isNotified && "text-primary hover:text-primary",
          value && isNotified && !isCompleted && "text-destructive hover:text-destructive",
        )}
        aria-label="设置到期日期"
      >
        <CalendarIcon className="size-4" />
      </Button>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          onClick={handleClear}
          disabled={disabled}
          aria-label="清除到期日期"
        >
          <X className="size-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-h-[calc(100vh-4rem)] sm:max-w-sm md:max-w-[calc(100%-4rem)]">
          <div className="flex h-full max-h-[calc(100vh-2rem)] flex-col sm:max-h-[calc(100vh-4rem)]">
            <DialogHeader className="flex-shrink-0 px-6 pt-6">
              <DialogTitle>设置到期时间</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="time-picker" className="text-sm">
                    时间
                  </Label>
                  <Input
                    type="time"
                    id="time-picker"
                    value={tempTime}
                    onChange={(event) => setTempTime(event.target.value)}
                    className="h-9"
                  />
                </div>
                {tempDate && (
                  <div className="space-y-2">
                    <Label htmlFor="remind-before" className="text-sm">
                      提前提醒（分钟）
                    </Label>
                    <Input
                      type="number"
                      id="remind-before"
                      min={0}
                      max={1440}
                      step={1}
                      value={tempReminderOffset}
                      onChange={(event) =>
                        setTempReminderOffset(parseInt(event.target.value) || 0)
                      }
                      className="h-9"
                      placeholder="15"
                    />
                  </div>
                )}
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={tempDate}
                    onSelect={setTempDate}
                    autoFocus
                    className="rounded-md border"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-2 border-t px-6 py-4">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={!tempDate}>
                确定
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
