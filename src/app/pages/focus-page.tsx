import { PomodoroTimer } from "@/features/pomodoro/components/pomodoro-timer"

interface FocusPageProps {
  focusTodoId?: number | null
  onCancel?: () => void
}

export function FocusPage(_props: FocusPageProps) {
  return <PomodoroTimer />
}
