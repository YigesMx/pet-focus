import { useState, useCallback, useMemo } from "react"
import { Search, Link2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LinkedTodoBlock } from "./linked-todo-block"
import { useTodosQuery } from "@/features/todo/api/todo.queries"
import { useTodoMutations } from "@/features/todo/hooks/useTodoMutations"
import { TodoDetailDialog } from "@/features/todo/components/todo-detail-dialog"
import {
  useSessionTodoLinksQuery,
  useAddSessionTodoLinkMutation,
  useRemoveSessionTodoLinkMutation,
} from "@/features/pomodoro/hooks"
import type { Todo } from "@/features/todo/types/todo.types"

interface SessionTodoLinkSelectorProps {
  /** Session ID，为 0 或负数时使用暂存模式 */
  sessionId: number
  /** 暂存模式：当前关联的 todo IDs */
  pendingTodoIds?: number[]
  /** 暂存模式：todo IDs 变更回调 */
  onPendingChange?: (todoIds: number[]) => void
  className?: string
}

export function SessionTodoLinkSelector({
  sessionId,
  pendingTodoIds = [],
  onPendingChange,
  className,
}: SessionTodoLinkSelectorProps) {
  const [searchValue, setSearchValue] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTodoId, setDetailTodoId] = useState<number | null>(null)

  // 是否使用暂存模式
  const isPendingMode = sessionId <= 0 || !!onPendingChange

  // 获取所有 todos
  const { data: allTodos = [] } = useTodosQuery()

  // 获取当前 session 的关联（仅在真实模式下使用）
  const { data: links = [] } = useSessionTodoLinksQuery(sessionId)

  // Mutations（仅在真实模式下使用）
  const addLinkMutation = useAddSessionTodoLinkMutation()
  const removeLinkMutation = useRemoveSessionTodoLinkMutation()

  // Todo mutations（用于 LinkedTodoBlock）
  const {
    updateTitle,
    toggleCompleted,
    updateParent,
    reorder,
    deleteTodo,
    busyTodoIds,
    createTodo,
    updateDetails,
  } = useTodoMutations()

  // 更新截止日期处理
  const handleUpdateDueDate = useCallback(
    async (id: number, dueDate: string | null, reminderOffsetMinutes?: number | null) => {
      // 获取当前 todo 来保留其他字段
      const todo = allTodos.find(t => t.id === id)
      if (!todo) return
      
      await updateDetails(id, {
        description: todo.description,
        priority: todo.priority,
        location: todo.location,
        tags: todo.tags || [],
        start_at: todo.start_at,
        due_date: dueDate,
        recurrence_rule: todo.recurrence_rule,
        reminder_offset_minutes: reminderOffsetMinutes ?? null,
        reminder_method: todo.reminder_method,
        timezone: todo.timezone,
      })
    },
    [allTodos, updateDetails]
  )

  // 已关联的 todo IDs（根据模式选择数据源）
  const linkedTodoIds = useMemo(() => {
    if (isPendingMode && onPendingChange) {
      return new Set(pendingTodoIds)
    }
    return new Set(links.map((link) => link.todoId))
  }, [isPendingMode, onPendingChange, pendingTodoIds, links])

  // 已关联的 todos
  const linkedTodos = useMemo(() => {
    if (isPendingMode && onPendingChange) {
      // 暂存模式：根据 pendingTodoIds 获取 todos
      return pendingTodoIds
        .map((id) => allTodos.find((todo) => todo.id === id))
        .filter((todo): todo is Todo => todo !== undefined)
    }
    // 真实模式：根据 links 获取 todos（保持排序）
    return links
      .map((link) => allTodos.find((todo) => todo.id === link.todoId))
      .filter((todo): todo is Todo => todo !== undefined)
  }, [isPendingMode, onPendingChange, pendingTodoIds, links, allTodos])

  // 可搜索的 todos（未关联的）
  const searchableTodos = useMemo(() => {
    if (!searchValue.trim()) return []

    const search = searchValue.toLowerCase()
    return allTodos.filter((todo) => {
      // 排除已关联的
      if (linkedTodoIds.has(todo.id)) return false
      // 匹配标题
      return todo.title.toLowerCase().includes(search)
    })
  }, [allTodos, linkedTodoIds, searchValue])

  // 处理添加关联
  const handleAddLink = useCallback(
    (todoId: number) => {
      if (isPendingMode && onPendingChange) {
        // 暂存模式：直接更新 pending 列表
        onPendingChange([...pendingTodoIds, todoId])
        toast.success("已添加待办关联")
      } else {
        // 真实模式：调用 API
        addLinkMutation.mutate(
          { sessionId, todoId },
          {
            onSuccess: () => {
              toast.success("已关联待办")
            },
            onError: (error) => {
              const message = error?.message || String(error) || "未知错误"
              toast.error(`关联失败: ${message}`)
              console.error("Add link error:", error)
            },
          }
        )
      }
      setSearchValue("")
      setIsOpen(false)
    },
    [isPendingMode, onPendingChange, pendingTodoIds, sessionId, addLinkMutation]
  )

  // 处理移除关联
  const handleRemoveLink = useCallback(
    (todoId: number) => {
      if (isPendingMode && onPendingChange) {
        // 暂存模式：直接更新 pending 列表
        onPendingChange(pendingTodoIds.filter((id) => id !== todoId))
        toast.success("已移除待办关联")
      } else {
        // 真实模式：调用 API
        removeLinkMutation.mutate(
          { sessionId, todoId },
          {
            onSuccess: () => {
              toast.success("已取消关联")
            },
            onError: (error) => {
              const message = error?.message || String(error) || "未知错误"
              toast.error(`取消关联失败: ${message}`)
              console.error("Remove link error:", error)
            },
          }
        )
      }
    },
    [isPendingMode, onPendingChange, pendingTodoIds, sessionId, removeLinkMutation]
  )

  // 检查 todo 是否有子任务
  const hasChildren = useCallback(
    (todoId: number) => {
      return allTodos.some((t) => t.parent_id === todoId)
    },
    [allTodos]
  )

  // 添加子任务处理
  const handleAddSubtask = useCallback(
    async (parentId: number) => {
      const newTodo = await createTodo()
      if (newTodo) {
        await updateParent(newTodo.id, parentId)
      }
    },
    [createTodo, updateParent]
  )

  // 打开详情处理
  const handleOpenDetails = useCallback((todo: Todo) => {
    setDetailTodoId(todo.id)
    setDetailOpen(true)
  }, [])

  // 详情对话框关闭处理
  const handleDetailOpenChange = useCallback((open: boolean) => {
    setDetailOpen(open)
    if (!open) {
      setDetailTodoId(null)
    }
  }, [])

  // 详情提交处理
  const handleSubmitDetails = useCallback(
    async (id: number, payload: Parameters<typeof updateDetails>[1]) => {
      await updateDetails(id, payload)
    },
    [updateDetails]
  )

  // 当前编辑的 todo
  const activeTodo = useMemo<Todo | null>(() => {
    if (detailTodoId === null) return null
    return allTodos.find((item) => item.id === detailTodoId) ?? null
  }, [detailTodoId, allTodos])

  return (
    <div className={className}>
      {/* 搜索选择器 */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground"
          >
            <Link2 className="mr-2 size-4" />
            关联待办...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="搜索待办..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="border-0 p-0 focus-visible:ring-0"
            />
          </div>
          <ScrollArea className="max-h-64">
            {searchValue.trim() === "" ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                输入关键词搜索待办
              </div>
            ) : searchableTodos.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                没有找到匹配的待办
              </div>
            ) : (
              <div className="p-1">
                {searchableTodos.map((todo) => (
                  <button
                    key={todo.id}
                    className="w-full rounded px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => handleAddLink(todo.id)}
                  >
                    <div className="font-medium truncate">{todo.title}</div>
                    {todo.completed && (
                      <span className="text-xs text-muted-foreground">
                        (已完成)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* 已关联的 Todos 列表 */}
      {linkedTodos.length > 0 && (
        <div className="mt-3 space-y-2">
          {linkedTodos.map((todo) => (
            <LinkedTodoBlock
              key={todo.id}
              todo={todo}
              allTodos={allTodos}
              hasChildren={hasChildren(todo.id)}
              onUnlink={handleRemoveLink}
              busyTodoIds={busyTodoIds}
              onToggleCompleted={(id, completed) => {
                void toggleCompleted(id, completed)
              }}
              onUpdateTitle={(id, title) => {
                void updateTitle(id, title)
              }}
              onOpenDetails={handleOpenDetails}
              onDelete={(id) => {
                void deleteTodo(id)
              }}
              onUpdateParent={(id, parentId) => {
                void updateParent(id, parentId)
              }}
              onReorder={(id, beforeId, afterId, newParentId) => {
                void reorder(id, beforeId, afterId, newParentId)
              }}
              onAddSubtask={handleAddSubtask}
              onUpdateDueDate={(id, dueDate, reminderOffsetMinutes) => {
                void handleUpdateDueDate(id, dueDate, reminderOffsetMinutes)
              }}
            />
          ))}
        </div>
      )}

      {/* Todo 详情对话框 */}
      <TodoDetailDialog
        todo={activeTodo}
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        onSubmit={handleSubmitDetails}
        isSubmitting={activeTodo ? busyTodoIds.has(activeTodo.id) : false}
      />
    </div>
  )
}
