import type { Todo } from "@/features/todo/types/todo.types"

// 扁平化的 Todo 项，包含层级信息
export type FlattenedTodo = Todo & {
  depth: number
  parentId: number | null
  index: number
}

export type TodoListProps = {
  todos: Todo[]
  isLoading?: boolean
  busyTodoIds?: Set<number>
  onToggleCompleted: (id: number, completed: boolean) => void
  onUpdateTitle: (id: number, title: string) => void
  onOpenDetails: (todo: Todo) => void
  onDelete: (id: number) => void
  onUpdateParent: (id: number, parentId: number | null) => void
  onReorder: (id: number, beforeId: number | null, afterId: number | null, newParentId: number | null) => void
  onAddSubtask: (parentId: number) => void
  onStartFocus?: (todoId: number) => void
  onUpdateDueDate?: (id: number, dueDate: string | null, reminderOffsetMinutes?: number | null) => void
}

export type SortableTodoItemProps = {
  id: number
  todo: FlattenedTodo
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  busyTodoIds: Set<number>
  clone?: boolean
  childCount?: number
  toggleExpanded: (id: number) => void
  onToggleCompleted: (id: number, completed: boolean) => void
  onUpdateTitle: (id: number, title: string) => void
  onOpenDetails: (todo: Todo) => void
  onDelete: (id: number) => void
  onAddSubtask: (parentId: number) => void
  onStartFocus?: (todoId: number) => void
  onUpdateDueDate?: (id: number, dueDate: string | null, reminderOffsetMinutes?: number | null) => void
  openActionId: number | null
  setOpenActionId: (id: number | null) => void
}
