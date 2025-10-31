import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Todo } from "@/types/todo"

type TodoItemProps = {
  todo: Todo
  disabled?: boolean
  onToggleCompleted: (id: number, completed: boolean) => void
  onUpdateTitle: (id: number, title: string) => void
  onDelete: (id: number) => void
}

export function TodoItem({
  todo,
  disabled = false,
  onToggleCompleted,
  onUpdateTitle,
  onDelete,
}: TodoItemProps) {
  const [draftTitle, setDraftTitle] = useState(todo.title)

  useEffect(() => {
    setDraftTitle(todo.title)
  }, [todo.title])

  const handleBlur = () => {
    const normalized = draftTitle.trim()
    if (normalized !== todo.title) {
      onUpdateTitle(todo.id, normalized)
    }
  }

  const handleToggle = (checked: true|false) => {
    onToggleCompleted(todo.id, checked === true)
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 shadow-sm transition hover:shadow-md">
      <Checkbox
      checked={todo.completed}
      onCheckedChange={handleToggle}
      disabled={disabled}
      aria-label={todo.completed ? "标记为未完成" : "标记为已完成"}
      />
      <Textarea
      value={draftTitle}
      disabled={disabled}
      onChange={(event) => setDraftTitle(event.target.value)}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.currentTarget.blur()
        }
      }}
      placeholder="记录你的待办事项"
      className={cn(
        "min-h-[2.5rem] flex-1 resize-none border-none bg-transparent p-0 text-base shadow-none focus-visible:ring-0",
        todo.completed && "text-muted-foreground line-through"
      )}
      />
      <Button
      variant="ghost"
      size="icon"
      className="self-start text-muted-foreground hover:text-destructive"
      onClick={() => onDelete(todo.id)}
      disabled={disabled}
      aria-label="删除待办"
      >
      <Trash2 className="size-4" />
      </Button>
    </div>
  )
}
