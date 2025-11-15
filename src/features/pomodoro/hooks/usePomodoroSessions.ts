import { useQuery } from "@tanstack/react-query"
import { listPomodoroSessions, type PomodoroSession } from "@/features/pomodoro/api/pomodoro.api"

export function usePomodoroSessions(limit = 50) {
  return useQuery({
    queryKey: ["pomodoro-sessions", limit],
    queryFn: () => listPomodoroSessions(limit),
  })
}

export type { PomodoroSession }
