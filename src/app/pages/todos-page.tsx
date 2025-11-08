import { useCallback, useMemo, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { TodoDetailDialog } from "@/features/todo/components/todo-detail-dialog"
import { TodoHeader } from "@/features/todo/components/todo-header"
import { TodoList } from "@/features/todo/components/todo-list"
import { useTodosQuery } from "@/features/todo/api/todo.queries"
import { useTodoMutations } from "@/features/todo/hooks/useTodoMutations"
import { useTodoSyncEvents } from "@/features/todo/hooks/useTodoSyncEvents"
import type { Todo } from "@/features/todo/types/todo.types"

export function TodosPage() {
  const { data: todos = [], isPending } = useTodosQuery()
  const {
    createTodo,
    updateTitle,
    toggleCompleted,
    updateDetails,
    deleteTodo,
    busyTodoIds,
    isCreating,
  } = useTodoMutations()

  useTodoSyncEvents()

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
            onDelete={(id) => {
              void deleteTodo(id)
            }}
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
