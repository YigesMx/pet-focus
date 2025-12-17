import { CatPomodoroTimer } from "@/features/pomodoro/components/cat-pomodoro-timer"

interface FocusPageProps {
  focusTodoId?: number | null
  onFocusStarted?: () => void
  onCancel?: () => void
}

export function FocusPage({ focusTodoId, onFocusStarted }: FocusPageProps) {
  return <CatPomodoroTimer initialTodoId={focusTodoId} onFocusStarted={onFocusStarted} />
}
