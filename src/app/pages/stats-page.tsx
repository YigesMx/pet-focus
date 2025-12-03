import { useMemo, useState } from "react"
import { Clock, Trash2, Edit2, Check, X, TrendingUp, Flame } from "lucide-react"
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
  useUpdateSessionNote,
  useDeleteSessionCascade,
} from "@/features/pomodoro/hooks"
import { useCompleteStats } from "@/features/pomodoro/hooks/useStats"
import { generateSessionTitle, listSessionRecords } from "@/features/pomodoro/api/session.api"
import type { PomodoroRecord } from "@/features/pomodoro/api/session.api"
import { ContributionWall } from "@/components/app/contribution-wall"
import { toast } from "sonner"

interface SessionItemProps {
  sessionId: number
  onDelete: (sessionId: number) => void
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

function SessionItem({ sessionId, onDelete }: SessionItemProps) {
  const [title, setTitle] = useState<string>("")
  const [records, setRecords] = useState<PomodoroRecord[]>([])
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState("")
  
  const updateNoteMutation = useUpdateSessionNote()
  const { data: sessions = [] } = useSessions(false)
  
  const session = sessions.find(s => s.id === sessionId)

  // 加载标题和记录
  useMemo(() => {
    if (sessionId > 0) {
      generateSessionTitle(sessionId).then(setTitle).catch(() => setTitle("加载失败"))
      listSessionRecords(sessionId).then(setRecords).catch(() => setRecords([]))
    }
  }, [sessionId])

  const handleEditNote = () => {
    setNoteValue(session?.note ?? "")
    setIsEditingNote(true)
  }

  const handleSaveNote = () => {
    if (session) {
      updateNoteMutation.mutate(
        { sessionId: session.id, note: noteValue || null },
        {
          onSuccess: () => {
            setIsEditingNote(false)
            toast.success("备注已更新")
          },
        }
      )
    }
  }

  const handleCancelEditNote = () => {
    setIsEditingNote(false)
    setNoteValue("")
  }

  const focusRecords = records.filter(r => r.kind === "focus")
  const totalSeconds = focusRecords.reduce((acc, r) => acc + r.elapsed_seconds, 0)

  return (
    <AccordionItem value={`session-${sessionId}`} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline py-4">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium">{title}</span>
              {session?.archived && (
                <Badge variant="secondary" className="text-xs">
                  已归档
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {records.length} 条记录 · {formatDuration(totalSeconds)}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(sessionId)
            }}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">删除会话</span>
          </Button>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        {/* 备注区域 */}
        {(session?.note || isEditingNote) && (
          <div className="mb-4 p-3 rounded-md bg-muted/50">
            {isEditingNote ? (
              <div className="space-y-2">
                <Textarea
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder="添加备注..."
                  rows={3}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={updateNoteMutation.isPending}
                  >
                    <Check className="size-4 mr-1" />
                    保存
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEditNote}>
                    <X className="size-4 mr-1" />
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-muted-foreground flex-1">{session?.note}</p>
                <Button size="sm" variant="ghost" onClick={handleEditNote} className="h-6 w-6 p-0">
                  <Edit2 className="size-3" />
                </Button>
              </div>
            )}
          </div>
        )}
        {!session?.note && !isEditingNote && (
          <div className="mb-4">
            <Button size="sm" variant="outline" onClick={handleEditNote} className="w-full">
              <Edit2 className="size-4 mr-1" />
              添加备注
            </Button>
          </div>
        )}

        {/* Records 列表 */}
        <div className="space-y-2">
          {records.map((record, index) => {
            const date = new Date(record.start_at)
            const timeStr = date.toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })

            const statusMap = {
              completed: { label: "完成", variant: "default" as const },
              skipped: { label: "跳过", variant: "secondary" as const },
              stopped: { label: "停止", variant: "outline" as const },
            }
            const statusInfo = statusMap[record.status as keyof typeof statusMap] || {
              label: record.status,
              variant: "secondary" as const,
            }

            return (
              <div
                key={record.id}
                className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">#{index + 1}</span>
                  <Badge variant={record.kind === "focus" ? "default" : "secondary"} className="text-xs">
                    {record.kind === "focus" ? "专注" : "休息"}
                  </Badge>
                  <Badge variant={statusInfo.variant} className="text-xs">
                    {statusInfo.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{timeStr}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {formatDuration(record.elapsed_seconds)}
                </Badge>
              </div>
            )
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export function StatsPage() {
  const { data: sessions = [] } = useSessions(true) // 显示所有sessions，包括已归档的
  const { daily: dailyStats, overall: overallStats, isLoading: statsLoading } = useCompleteStats()
  const deleteSessionMutation = useDeleteSessionCascade()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null)

  const handleDeleteClick = (sessionId: number) => {
    setSessionToDelete(sessionId)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (sessionToDelete !== null) {
      deleteSessionMutation.mutate(sessionToDelete, {
        onSuccess: () => {
          toast.success("会话已删除")
          setDeleteDialogOpen(false)
          setSessionToDelete(null)
        },
        onError: (error) => {
          toast.error(`删除失败：${error}`)
          setDeleteDialogOpen(false)
          setSessionToDelete(null)
        },
      })
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setSessionToDelete(null)
  }

  // 计算今日统计
  const todayStats = useMemo(() => {
    if (!dailyStats.length) return { seconds: 0, sessions: 0 }
    const today = new Date().toISOString().split("T")[0]
    const todayStat = dailyStats.find((s) => s.date === today)
    return {
      seconds: todayStat?.focusSeconds ?? 0,
      sessions: todayStat?.sessionCount ?? 0,
    }
  }, [dailyStats])

  return (
    <>
      {/* 砖墙贡献图 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            专注热力图
          </CardTitle>
          <CardDescription>过去 365 天的专注活动记录</CardDescription>
        </CardHeader>
        <CardContent>
          <ContributionWall data={dailyStats} isLoading={statsLoading} className="overflow-x-auto" />
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 今日专注时间 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">今日专注</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatDuration(todayStats.seconds)}</div>
            <p className="text-xs text-muted-foreground mt-1">{todayStats.sessions} 个会话</p>
          </CardContent>
        </Card>

        {/* 总专注时间 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">总专注时间</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {overallStats
                ? (() => {
                    const hours = Math.floor(overallStats.totalFocusSeconds / 3600)
                    const days = Math.floor(hours / 24)
                    return days > 0 ? `${days}天` : formatDuration(overallStats.totalFocusSeconds)
                  })()
                : "-"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overallStats ? overallStats.totalRecords : 0} 条记录
            </p>
          </CardContent>
        </Card>

        {/* 连续活动 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="size-4" />
              当前连胜
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overallStats?.currentStreak ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">天</p>
          </CardContent>
        </Card>

        {/* 最长连续 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">最长连胜</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overallStats?.longestStreak ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">天</p>
          </CardContent>
        </Card>
      </div>

      {/* 详细信息 */}
      {overallStats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">总会话数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalSessions}</div>
              <p className="text-xs text-muted-foreground mt-1">个专注会话</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">日均专注</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(Math.round(overallStats.avgSecondsPerDay))}</div>
              <p className="text-xs text-muted-foreground mt-1">每天平均</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">活跃天数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dailyStats.length}</div>
              <p className="text-xs text-muted-foreground mt-1">天有记录</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions 列表 */}
      <Card>
        <CardHeader>
          <CardTitle>专注会话</CardTitle>
          <CardDescription>所有已记录的专注会话</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
              <Clock className="size-8" aria-hidden="true" />
              <div className="text-base font-medium">暂无会话记录</div>
              <p className="max-w-sm text-sm">开始你的第一个专注会话吧</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  sessionId={session.id}
                  onDelete={handleDeleteClick}
                />
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这个会话及其所有记录吗？此操作无法撤销。
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
