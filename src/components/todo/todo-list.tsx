import { ListTodo, Loader2 } from "lucide-react"

import { TodoItem } from "@/components/todo/todo-item"
import type { Todo } from "@/types/todo"

type TodoListProps = {
  todos: Todo[]
  isLoading?: boolean
  busyTodoIds?: Set<number>
  onToggleCompleted: (id: number, completed: boolean) => void
  onUpdateTitle: (id: number, title: string) => void
  onUpdateDueDate: (id: number, dueDate: string | null) => void
  onDelete: (id: number) => void
}

export function TodoList({
  todos,
  isLoading = false,
  busyTodoIds = new Set<number>(),
  onToggleCompleted,
  onUpdateTitle,
  onUpdateDueDate,
  onDelete,
}: TodoListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <span>正在加载待办...</span>
      </div>
    )
  }

  if (todos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
        <ListTodo className="size-8" aria-hidden="true" />
        <div className="text-base font-medium">暂无待办</div>
        <p className="max-w-sm text-sm">点击顶部的“新建待办”按钮开始记录你的任务。</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          disabled={busyTodoIds.has(todo.id)}
          onToggleCompleted={onToggleCompleted}
          onUpdateTitle={onUpdateTitle}
          onUpdateDueDate={onUpdateDueDate}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
