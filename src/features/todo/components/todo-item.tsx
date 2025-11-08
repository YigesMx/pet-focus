import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Item, ItemContent } from "@/components/ui/item"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/shared/lib/utils"

import type { Todo } from "@/features/todo/types/todo.types"

type TodoItemProps = {
  todo: Todo
  disabled?: boolean
  onToggleCompleted: (id: number, completed: boolean) => void
  onUpdateTitle: (id: number, title: string) => void
  onOpenDetails: (todo: Todo) => void
  onDelete: (id: number) => void
}

export function TodoItem({
  todo,
  disabled = false,
  onToggleCompleted,
  onUpdateTitle,
  onOpenDetails,
  onDelete,
}: TodoItemProps) {
  const [draftTitle, setDraftTitle] = useState(todo.title)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  useEffect(() => {
    setDraftTitle(todo.title)
  }, [todo.title])

  useEffect(() => {
    autoResize()
  }, [draftTitle, autoResize])

  const handleBlur = () => {
    const normalized = draftTitle.trim()
    if (normalized !== todo.title) {
      onUpdateTitle(todo.id, normalized)
    }
  }

  const handleToggle = (checked: true | false) => {
    onToggleCompleted(todo.id, checked === true)
  }

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraftTitle(event.target.value)
    const target = event.currentTarget
    target.style.height = "auto"
    target.style.height = `${target.scrollHeight}px`
  }

  const dueLabel = useMemo(() => {
    if (!todo.due_date) return null
    const date = new Date(todo.due_date)
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }, [todo.due_date])

  return (
    <Item
      variant="outline"
      size="sm"
      className="bg-card shadow-sm transition hover:shadow-md"
    >
      <ItemContent className="gap-2">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={todo.completed}
            onCheckedChange={handleToggle}
            disabled={disabled}
            aria-label={todo.completed ? "标记为未完成" : "标记为已完成"}
          />
          <Textarea
            ref={textareaRef}
            value={draftTitle}
            disabled={disabled}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.currentTarget.blur()
              }
            }}
            placeholder="记录你的待办事项"
            className={cn(
              "min-h-[2.5rem] flex-1 resize-none bg-transparent shadow-none",
              todo.completed && "text-muted-foreground line-through",
            )}
            rows={1}
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(todo.id)}
            disabled={disabled}
            aria-label="删除待办"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
          <span
            className={cn(
              todo.notified && !todo.completed && "text-destructive font-medium",
            )}
          >
            {dueLabel ? `到期：${dueLabel}` : "未设置到期时间"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenDetails(todo)}
            disabled={disabled}
          >
            详情
          </Button>
        </div>
      </ItemContent>
    </Item>
  )
}
