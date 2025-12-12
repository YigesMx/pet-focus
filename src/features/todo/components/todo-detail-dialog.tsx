import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { CalendarClock, MapPin, Repeat, Tag, Timer, Check, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { TagSelector } from "@/features/tag/components"
import { useTagsQuery, useSetTaskTagsMutation } from "@/features/tag/api"

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
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [startAt, setStartAt] = useState("")
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [recurrenceRule, setRecurrenceRule] = useState("")
  const [reminderOffset, setReminderOffset] = useState<number>(15)
  const [reminderMethod, setReminderMethod] = useState(DEFAULT_REMINDER_METHOD)
  const [timezone, setTimezone] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // 跟踪初始化状态，避免初始化时触发保存
  const isInitializedRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentTodoIdRef = useRef<number | null>(null)
  const isSavingRef = useRef(false) // 跟踪是否正在保存，避免保存期间的数据刷新触发新的保存

  const busy = isSubmitting || isSaving

  // 获取所有标签用于匹配
  const { data: allTags = [] } = useTagsQuery()
  const setTaskTagsMutation = useSetTaskTagsMutation()

  // 根据 todo.tags 字符串数组找到对应的 tag ids
  const initialTagIds = useMemo(() => {
    if (!todo?.tags || allTags.length === 0) return []
    return todo.tags
      .map((tagName) => {
        const tag = allTags.find(
          (t) => t.name.toLowerCase() === tagName.toLowerCase(),
        )
        return tag?.id
      })
      .filter((id): id is number => id !== undefined)
  }, [todo?.id, todo?.tags, allTags])

  useEffect(() => {
    if (!open || !todo) {
      // 重置初始化状态
      isInitializedRef.current = false
      currentTodoIdRef.current = null
      return
    }

    // 只在切换到不同的 todo 时才重新初始化
    if (currentTodoIdRef.current !== todo.id) {
      isInitializedRef.current = false
      currentTodoIdRef.current = todo.id
      
      // 初始化所有字段
      setDescription(todo.description ?? "")
      setPriority(todo.priority ?? null)
      setLocation(todo.location ?? "")
      setStartAt(isoToLocalInput(todo.start_at))
      setDueDate(todo.due_date)
      setRecurrenceRule(todo.recurrence_rule ?? "")
      setReminderOffset(todo.reminder_offset_minutes ?? 0)
      setReminderMethod(todo.reminder_method ?? DEFAULT_REMINDER_METHOD)
      setTimezone(todo.timezone ?? "")
      setSelectedTagIds(initialTagIds)
      setLastSaved(null)

      // 延迟设置初始化完成，避免初始 setState 触发保存
      setTimeout(() => {
        isInitializedRef.current = true
      }, 100)
    }
    // 注意：这里不依赖 todo，只依赖 open 和 todo.id
  }, [open, todo?.id, initialTagIds, todo])

  // 将选中的 tag ids 转换为 tag names（用于保存到 CalDAV 兼容的 tags 字段）
  const getSelectedTagNames = useCallback(() => {
    return selectedTagIds
      .map((id) => allTags.find((t) => t.id === id)?.name)
      .filter((name): name is string => name !== undefined)
  }, [selectedTagIds, allTags])

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      // 清除待执行的保存
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      setIsSaving(false)
      isSavingRef.current = false
      isInitializedRef.current = false
    }
    onOpenChange(nextOpen)
  }

  // 自动保存函数
  const performSave = useCallback(async () => {
    if (!todo || !isInitializedRef.current || isSavingRef.current) return

    const trimmedDescription = description.trim()
    const trimmedLocation = location.trim()
    const trimmedRecurrence = recurrenceRule.trim()
    const trimmedTimezone = timezone.trim()
    const trimmedMethod = reminderMethod.trim()

    // 将选中的 tag ids 转换为 tag names（CalDAV 兼容）
    const tagNames = getSelectedTagNames()

    const payload: TodoDetailUpdate = {
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      priority: priority,
      location: trimmedLocation.length > 0 ? trimmedLocation : null,
      tags: tagNames,
      start_at: localInputToIso(startAt),
      due_date: dueDate,
      recurrence_rule: trimmedRecurrence.length > 0 ? trimmedRecurrence : null,
      reminder_offset_minutes: Number.isFinite(reminderOffset) ? reminderOffset : null,
      reminder_method: trimmedMethod.length > 0 ? trimmedMethod : null,
      timezone: trimmedTimezone.length > 0 ? trimmedTimezone : null,
    }

    try {
      setIsSaving(true)
      isSavingRef.current = true
      
      // 保存标签到多对多表
      await setTaskTagsMutation.mutateAsync({
        taskId: todo.id,
        tagIds: selectedTagIds,
      })
      // 保存其他详情（包括 tags 字符串数组）
      await onSubmit(todo.id, payload)
      setLastSaved(new Date())
      
      // 保存成功后，延迟一段时间再允许新的保存，避免数据刷新触发新保存
      setTimeout(() => {
        isSavingRef.current = false
      }, 300)
    } catch (error) {
      console.error("自动保存待办详情失败", error)
      isSavingRef.current = false
    } finally {
      setIsSaving(false)
    }
  }, [
    todo,
    description,
    priority,
    location,
    selectedTagIds,
    startAt,
    dueDate,
    recurrenceRule,
    reminderOffset,
    reminderMethod,
    timezone,
    getSelectedTagNames,
    setTaskTagsMutation,
    onSubmit,
  ])

  // 防抖保存 - 当任意字段变化时触发
  const debouncedSave = useCallback(() => {
    if (!isInitializedRef.current || !todo || isSavingRef.current) return

    // 清除之前的延时
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // 设置新的延时保存（500ms）
    saveTimeoutRef.current = setTimeout(() => {
      performSave()
    }, 500)
  }, [performSave, todo])

  // 监听所有字段变化，触发自动保存
  useEffect(() => {
    if (isInitializedRef.current && todo) {
      debouncedSave()
    }
    // 清理函数
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [
    description,
    priority,
    location,
    selectedTagIds,
    startAt,
    dueDate,
    recurrenceRule,
    reminderOffset,
    reminderMethod,
    timezone,
    debouncedSave,
    todo,
  ])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card text-card-foreground max-h-[calc(100vh-2rem)] max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-h-[calc(100vh-4rem)] sm:max-w-2xl md:max-w-[calc(100%-4rem)] lg:max-w-3xl">
        <div className="flex h-full max-h-[calc(100vh-2rem)] flex-col sm:max-h-[calc(100vh-4rem)]">
          <DialogHeader className="px-6 pt-6 shrink-0">
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
                    <Label className="flex items-center gap-2">
                      <Tag className="size-4" />
                      标签
                    </Label>
                    <TagSelector
                      selectedTagIds={selectedTagIds}
                      onTagsChange={setSelectedTagIds}
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

          <div className="flex items-center justify-between border-t px-6 py-4 shrink-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>保存中...</span>
                </>
              ) : lastSaved ? (
                <>
                  <Check className="size-4 text-green-500" />
                  <span>已保存</span>
                </>
              ) : (
                <span>修改后自动保存</span>
              )}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              关闭
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
