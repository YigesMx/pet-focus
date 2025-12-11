import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Card, CardContent } from "@/components/ui/card"
import { TodoDetailDialog } from "@/features/todo/components/todo-detail-dialog"
import { TodoHeader } from "@/features/todo/components/todo-header"
import { TodoList } from "@/features/todo/components/todo-list"
import { useTodosQuery } from "@/features/todo/api/todo.queries"
import { useTodoMutations } from "@/features/todo/hooks/useTodoMutations"
import { useTodoSyncEvents } from "@/features/todo/hooks/useTodoSyncEvents"
import { todoKeys } from "@/features/todo/api/todo.keys"
import type { Todo } from "@/features/todo/types/todo.types"

interface TodosPageProps {
  onStartFocus?: (todoId: number) => void
}

export function TodosPage({ onStartFocus }: TodosPageProps) {
  const queryClient = useQueryClient()
  const { data: todos = [], isPending } = useTodosQuery()
  const {
    createTodo,
    updateTitle,
    toggleCompleted,
    updateDetails,
    updateParent,
    reorder,
    deleteTodo,
    busyTodoIds,
    isCreating,
  } = useTodoMutations()

  useTodoSyncEvents()

  // 每次进入 TodosPage 时强制刷新数据，确保显示最新内容
  useEffect(() => {
    console.log("[TodosPage] 页面挂载，强制刷新 Todo 列表")
    void queryClient.invalidateQueries({ queryKey: todoKeys.all })
  }, [])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTodoId, setDetailTodoId] = useState<number | null>(null)

  const activeTodo = useMemo<Todo | null>(() => {
    if (detailTodoId === null) return null
    return todos.find((item) => item.id === detailTodoId) ?? null
  }, [detailTodoId, todos])

  const handleOpenDetails = useCallback((todo: Todo) => {
    setDetailTodoId(todo.id)
    setDetailOpen(true)
  }, [])

  const handleDetailOpenChange = useCallback((open: boolean) => {
    setDetailOpen(open)
    if (!open) {
      setDetailTodoId(null)
    }
  }, [])

  const handleSubmitDetails = useCallback(
    async (id: number, payload: Parameters<typeof updateDetails>[1]) => {
      await updateDetails(id, payload)
    },
    [updateDetails],
  )

  const handleAddSubtask = useCallback(
    async (parentId: number) => {
      const newTodo = await createTodo()
      if (newTodo) {
        await updateParent(newTodo.id, parentId)
      }
    },
    [createTodo, updateParent],
  )

  return (
    <>
      <Card>
        <TodoHeader
          isCreating={isCreating}
          onCreateTodo={() => {
            void createTodo()
          }}
        />
        <CardContent className="pb-6">
          <TodoList
            todos={todos}
            isLoading={isPending}
            busyTodoIds={busyTodoIds}
            onToggleCompleted={(id, completed) => {
              void toggleCompleted(id, completed)
            }}
            onUpdateTitle={(id, title) => {
              void updateTitle(id, title)
            }}
            onOpenDetails={handleOpenDetails}
            onUpdateParent={(id, parentId) => {
              void updateParent(id, parentId)
            }}
            onReorder={(id, beforeId, afterId, newParentId) => {
              void reorder(id, beforeId, afterId, newParentId)
            }}
            onAddSubtask={handleAddSubtask}
            onDelete={(id) => {
              void deleteTodo(id)
            }}
            onStartFocus={onStartFocus}
          />
        </CardContent>
      </Card>

      <TodoDetailDialog
        todo={activeTodo}
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        onSubmit={handleSubmitDetails}
        isSubmitting={activeTodo ? busyTodoIds.has(activeTodo.id) : false}
      />
    </>
  )
}
