import { useEffect, useState } from "react"
import { CalendarClock, MapPin, Repeat, Tag, Timer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { TodoDueDatePicker } from "@/features/todo/components/todo-due-date-picker"
import { TodoPriorityPicker } from "@/features/todo/components/todo-priority-picker"
import type { Todo, TodoDetailUpdate } from "@/features/todo/types/todo.types"

interface TodoDetailDialogProps {
  todo: Todo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (id: number, payload: TodoDetailUpdate) => Promise<void>
  isSubmitting?: boolean
}

const DEFAULT_REMINDER_METHOD = "display"

function isoToLocalInput(value?: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  const tzOffset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - tzOffset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function localInputToIso(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }
  return parsed.toISOString()
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function TodoDetailDialog({
  todo,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: TodoDetailDialogProps) {
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<number | null>(null)
  const [location, setLocation] = useState("")
  const [tags, setTags] = useState("")
  const [startAt, setStartAt] = useState("")
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [recurrenceRule, setRecurrenceRule] = useState("")
  const [reminderOffset, setReminderOffset] = useState<number>(15)
  const [reminderMethod, setReminderMethod] = useState(DEFAULT_REMINDER_METHOD)
  const [timezone, setTimezone] = useState("")
  const [saving, setSaving] = useState(false)

  const busy = isSubmitting || saving

  useEffect(() => {
    if (!open || !todo) {
      return
    }

    setDescription(todo.description ?? "")
    setPriority(todo.priority ?? null)
    setLocation(todo.location ?? "")
    setTags(todo.tags.join(", "))
    setStartAt(isoToLocalInput(todo.start_at))
    setDueDate(todo.due_date)
    setRecurrenceRule(todo.recurrence_rule ?? "")
    setReminderOffset(todo.reminder_offset_minutes ?? 0)
    setReminderMethod(todo.reminder_method ?? DEFAULT_REMINDER_METHOD)
    setTimezone(todo.timezone ?? "")
  }, [open, todo])

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSaving(false)
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = async () => {
    if (!todo) return
    const trimmedDescription = description.trim()
    const trimmedLocation = location.trim()
    const trimmedRecurrence = recurrenceRule.trim()
    const trimmedTimezone = timezone.trim()
    const trimmedMethod = reminderMethod.trim()

    const payload: TodoDetailUpdate = {
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      priority: priority,
      location: trimmedLocation.length > 0 ? trimmedLocation : null,
      tags: parseTags(tags),
      start_at: localInputToIso(startAt),
      due_date: dueDate,
      recurrence_rule: trimmedRecurrence.length > 0 ? trimmedRecurrence : null,
      reminder_offset_minutes: Number.isFinite(reminderOffset) ? reminderOffset : null,
      reminder_method: trimmedMethod.length > 0 ? trimmedMethod : null,
      timezone: trimmedTimezone.length > 0 ? trimmedTimezone : null,
    }

    try {
      setSaving(true)
      await onSubmit(todo.id, payload)
      toast.success("待办详情已更新")
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error("更新待办详情失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-h-[calc(100vh-4rem)] sm:max-w-2xl md:max-w-[calc(100%-4rem)] lg:max-w-3xl">
        <div className="flex h-full max-h-[calc(100vh-2rem)] flex-col sm:max-h-[calc(100vh-4rem)]">
          <DialogHeader className="px-6 pt-6 flex-shrink-0">
            <DialogTitle>编辑待办详情</DialogTitle>
          </DialogHeader>

          {todo ? (
            <div className="flex-1 overflow-y-auto px-6 min-h-0">
              <div className="space-y-6 pb-6">
                <section className="space-y-3">
                  <div className="text-sm text-muted-foreground">标题</div>
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">{todo.title}</div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>优先级</Label>
                    <TodoPriorityPicker value={priority} onChange={setPriority} disabled={busy} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">时区</Label>
                    <Input
                      id="timezone"
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      placeholder="例如 Asia/Shanghai"
                      disabled={busy}
                    />
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start-at">开始时间</Label>
                    <Input
                      id="start-at"
                      type="datetime-local"
                      value={startAt}
                      onChange={(event) => setStartAt(event.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarClock className="size-4" />
                      截止时间与提醒
                    </Label>
                    <div className="rounded-md border p-3">
                      <TodoDueDatePicker
                        value={dueDate}
                        onChange={setDueDate}
                        reminderOffsetMinutes={reminderOffset}
                        onReminderOffsetChange={setReminderOffset}
                        isCompleted={todo.completed}
                        isNotified={todo.notified}
                        disabled={busy}
                      />
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recurrence" className="flex items-center gap-2">
                      <Repeat className="size-4" />
                      重复 (RRULE)
                    </Label>
                    <Input
                      id="recurrence"
                      value={recurrenceRule}
                      onChange={(event) => setRecurrenceRule(event.target.value)}
                      placeholder="例如 FREQ=DAILY;INTERVAL=1"
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reminder-method" className="flex items-center gap-2">
                      <Timer className="size-4" />
                      提醒方式
                    </Label>
                    <Input
                      id="reminder-method"
                      value={reminderMethod}
                      onChange={(event) => setReminderMethod(event.target.value)}
                      placeholder="display / email / sms"
                      disabled={busy}
                    />
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tags" className="flex items-center gap-2">
                      <Tag className="size-4" />
                      标签
                    </Label>
                    <Input
                      id="tags"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="以逗号分隔，例如 工作, 重要"
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location" className="flex items-center gap-2">
                      <MapPin className="size-4" />
                      位置
                    </Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="例如 公司会议室"
                      disabled={busy}
                    />
                  </div>
                </section>

                <Separator />

                <section className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={6}
                    placeholder="记录任务详情或参考信息"
                    disabled={busy}
                  />
                </section>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 pb-6 min-h-0">
              <div className="w-full rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                请选择一个待办以查看详情
              </div>
            </div>
          )}

          <DialogFooter className="border-t px-6 py-4 flex-shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={busy || !todo}>
              保存
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
