import { useState, useCallback, useMemo } from "react"
import { Unlink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TodoItem } from "@/features/todo/components/todo-item"
import { TodoList } from "@/features/todo/components/sortable-todo-list"
import type { Todo } from "@/features/todo/types/todo.types"

interface LinkedTodoBlockProps {
  // 根 Todo（链接的 todo）
  todo: Todo
  // 所有 todos（用于获取子任务）
  allTodos: Todo[]
  // 是否有子任务
  hasChildren: boolean
  // 取消链接回调
  onUnlink: (todoId: number) => void
  // 以下是 TodoItem 和 TodoList 需要的回调
  busyTodoIds: Set<number>
  onToggleCompleted: (id: number, completed: boolean) => void
  onUpdateTitle: (id: number, title: string) => void
  onOpenDetails: (todo: Todo) => void
  onDelete: (id: number) => void
  onUpdateParent: (id: number, parentId: number | null) => void
  onReorder: (id: number, beforeId: number | null, afterId: number | null, newParentId: number | null) => void
  onAddSubtask: (parentId: number) => void
  onUpdateDueDate?: (id: number, dueDate: string | null, reminderOffsetMinutes?: number | null) => void
}

export function LinkedTodoBlock({
  todo,
  allTodos,
  hasChildren,
  onUnlink,
  busyTodoIds,
  onToggleCompleted,
  onUpdateTitle,
  onOpenDetails,
  onDelete,
  onUpdateParent,
  onReorder,
  onAddSubtask,
  onUpdateDueDate,
}: LinkedTodoBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [moreActionsOpen, setMoreActionsOpen] = useState(false)

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  // 功能开关：根元素禁用删除和播放，但可以添加子任务
  const rootFeatureOptions = useMemo(() => ({
    disablePlay: true,
    disableDelete: true,
    disableAddSubtask: false,
  }), [])

  // 子任务功能开关：禁用播放
  const childFeatureOptions = useMemo(() => ({
    disablePlay: true,
    disableDelete: false,
    disableAddSubtask: false,
    disableDrag: false,
  }), [])

  return (
    <div className="rounded-lg border bg-card">
      {/* 根 Todo 区域 */}
      <div className="flex items-center gap-2 p-2">
        {/* Todo 内容 - TodoItem 自带展开按钮 */}
        <div className="flex-1 min-w-0">
          <TodoItem
            todo={todo}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            onToggleExpand={handleToggleExpand}
            onAddSubtask={() => onAddSubtask(todo.id)}
            moreActionsOpen={moreActionsOpen}
            setMoreActionsOpen={setMoreActionsOpen}
            disabled={busyTodoIds.has(todo.id)}
            onToggleCompleted={onToggleCompleted}
            onUpdateTitle={onUpdateTitle}
            onOpenDetails={onOpenDetails}
            onDelete={onDelete}
            onUpdateDueDate={onUpdateDueDate}
            {...rootFeatureOptions}
          />
        </div>

        {/* 取消链接按钮 */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onUnlink(todo.id)}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          title="取消关联"
        >
          <Unlink className="size-4" />
        </Button>
      </div>

      {/* 子任务列表（展开时显示） */}
      {isExpanded && hasChildren && (
        <div className="border-t px-2 pb-2 pt-2">
          <TodoList
            todos={allTodos}
            busyTodoIds={busyTodoIds}
            onToggleCompleted={onToggleCompleted}
            onUpdateTitle={onUpdateTitle}
            onOpenDetails={onOpenDetails}
            onDelete={onDelete}
            onUpdateParent={onUpdateParent}
            onReorder={onReorder}
            onAddSubtask={onAddSubtask}
            onUpdateDueDate={onUpdateDueDate}
            featureOptions={childFeatureOptions}
            rootTodoId={todo.id}
          />
        </div>
      )}
    </div>
  )
}
