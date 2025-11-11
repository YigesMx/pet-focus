import { useMemo } from "react"
import { Clock, ListTodo } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CompletedFocusSession } from "@/App"

interface StatsPageProps {
  completedSessions?: CompletedFocusSession[]
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`
  } else if (minutes > 0) {
    return `${minutes}分 ${secs}秒`
  } else {
    return `${secs}秒`
  }
}

export function StatsPage({ completedSessions = [] }: StatsPageProps) {
  const stats = useMemo(() => {
    const totalSeconds = completedSessions.reduce((acc, s) => acc + s.durationSeconds, 0)
    const totalCount = completedSessions.length
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todaySessions = completedSessions.filter(
      (s) => new Date(s.completedAt) >= todayStart
    )
    const todaySeconds = todaySessions.reduce((acc, s) => acc + s.durationSeconds, 0)

    return {
      totalSeconds,
      totalCount,
      todaySeconds,
      todayCount: todaySessions.length,
    }
  }, [completedSessions])

  const sortedSessions = useMemo(() => {
    return [...completedSessions].sort((a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    )
  }, [completedSessions])

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {/* 今日统计 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">今日专注时间</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatDuration(stats.todaySeconds)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.todayCount} 个任务</p>
          </CardContent>
        </Card>

        {/* 总体统计 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">总专注时间</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatDuration(stats.totalSeconds)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.totalCount} 个任务</p>
          </CardContent>
        </Card>
      </div>

      {/* 完成的任务列表 */}
      <Card>
        <CardHeader>
          <CardTitle>完成的任务</CardTitle>
          <CardDescription>所有已记录的专注会话</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedSessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
              <Clock className="size-8" aria-hidden="true" />
              <div className="text-base font-medium">暂无完成的任务</div>
              <p className="max-w-sm text-sm">从待办事项中选择任务开始专注计时</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sortedSessions.map((session) => {
                const date = new Date(session.completedAt)
                const dateStr = date.toLocaleDateString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                })
                const timeStr = date.toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })

                return (
                  <div
                    key={session.id}
                    className="flex items-start justify-between rounded-lg border border-border p-3 hover:bg-accent/50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{session.todoTitle}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dateStr} {timeStr}
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-2 whitespace-nowrap">
                      <Clock className="size-3 mr-1" />
                      {formatDuration(session.durationSeconds)}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
