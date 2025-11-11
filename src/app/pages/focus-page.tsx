import { useMemo } from "react"
import { FocusTimer } from "@/features/focus-timer/components/focus-timer"
import { useTodosQuery } from "@/features/todo/api/todo.queries"
import type { CompletedFocusSession } from "@/App"

interface FocusPageProps {
  focusTodoId?: number | null
  onSessionComplete?: (session: CompletedFocusSession) => void
  onCancel?: () => void
}

export function FocusPage({ focusTodoId, onSessionComplete, onCancel }: FocusPageProps) {
  const { data: todos = [] } = useTodosQuery()

  const focusTodo = useMemo(() => {
    if (!focusTodoId) return null
    return todos.find((todo) => todo.id === focusTodoId) || null
  }, [focusTodoId, todos])

  const handleSessionComplete = (durationSeconds: number, todoId: number, todoTitle: string) => {
    const session: CompletedFocusSession = {
      id: `${Date.now()}`,
      todoId,
      todoTitle,
      durationSeconds,
      completedAt: new Date().toISOString(),
    }
    onSessionComplete?.(session)
  }

  return (
    <FocusTimer
      todoId={focusTodo?.id}
      todoTitle={focusTodo?.title}
      onSessionComplete={handleSessionComplete}
      onCancel={onCancel}
    />
  )
}
