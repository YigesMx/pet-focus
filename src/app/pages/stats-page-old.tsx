import { useMemo, useState } from "react"
import { Clock, Trash2, Edit2, Check, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useSessions,
  useSessionRecords,
  useSessionTitle,
  useUpdateSessionNote,
  useDeleteSessionCascade,
  pomodoroKeys,
} from "@/features/pomodoro/hooks"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

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

export function StatsPage() {
  const queryClient = useQueryClient()
  const { data: sessions = [] } = usePomodoroSessions()
  const { data: todos = [] } = useTodosQuery()
  
  // 确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null)

  // 删除会话的 mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: number) => deletePomodoroSession(sessionId),
    onSuccess: () => {
      // 刷新会话列表
      queryClient.invalidateQueries({ queryKey: ["pomodoro-sessions"] })
      toast.success("已删除专注记录")
      setDeleteDialogOpen(false)
      setSessionToDelete(null)
    },
    onError: (error) => {
      toast.error(`删除失败：${error}`)
      setDeleteDialogOpen(false)
      setSessionToDelete(null)
    },
  })

  const handleDeleteClick = (sessionId: number) => {
    setSessionToDelete(sessionId)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (sessionToDelete !== null) {
      deleteSessionMutation.mutate(sessionToDelete)
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setSessionToDelete(null)
  }

  // 只显示专注会话（kind === "focus"），包括所有状态（completed, skipped, stopped）
  const focusSessions = useMemo(() => {
    return sessions.filter((s) => s.kind === "focus")
  }, [sessions])

  const stats = useMemo(() => {
    // 统计所有专注会话（包括 completed, skipped, stopped）
    const totalSeconds = focusSessions.reduce((acc, s) => acc + s.elapsed_seconds, 0)
    const totalCount = focusSessions.length
    
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todaySessions = focusSessions.filter(
      (s) => new Date(s.start_at) >= todayStart
    )
    const todaySeconds = todaySessions.reduce((acc, s) => acc + s.elapsed_seconds, 0)

    return {
      totalSeconds,
      totalCount,
      todaySeconds,
      todayCount: todaySessions.length,
    }
  }, [focusSessions])

  const sortedSessions = useMemo(() => {
    return [...focusSessions].sort((a, b) =>
      new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
    )
  }, [focusSessions])

  // 创建一个 todo ID 到 title 的映射
  const todoMap = useMemo(() => {
    return new Map(todos.map((todo) => [todo.id, todo.title]))
  }, [todos])

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
                const date = new Date(session.start_at)
                const dateStr = date.toLocaleDateString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                })
                const timeStr = date.toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })

                // 获取关联的 todo 标题
                const todoTitle = session.related_todo_id
                  ? todoMap.get(session.related_todo_id) || "未关联待办"
                  : "未关联待办"

                // 状态标签映射
                const statusMap = {
                  completed: { label: "完成", variant: "default" as const },
                  skipped: { label: "跳过", variant: "secondary" as const },
                  stopped: { label: "停止", variant: "outline" as const },
                }
                const statusInfo = statusMap[session.status] || { label: session.status, variant: "secondary" as const }

                return (
                  <div
                    key={session.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate text-sm">{todoTitle}</p>
                        <Badge variant={statusInfo.variant} className="shrink-0 text-xs">
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dateStr} {timeStr}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="whitespace-nowrap">
                        <Clock className="size-3 mr-1" />
                        {formatDuration(session.elapsed_seconds)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteClick(session.id)}
                        disabled={deleteSessionMutation.isPending}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">删除</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这条专注记录吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={deleteSessionMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteSessionMutation.isPending}
            >
              {deleteSessionMutation.isPending ? "删除中..." : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
