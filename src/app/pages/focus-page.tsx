import { PomodoroTimer } from "@/features/pomodoro/components/pomodoro-timer"

interface FocusPageProps {
  focusTodoId?: number | null
  onFocusStarted?: () => void
  onCancel?: () => void
}

export function FocusPage({ focusTodoId, onFocusStarted }: FocusPageProps) {
  return <PomodoroTimer initialTodoId={focusTodoId} onFocusStarted={onFocusStarted} />
}
