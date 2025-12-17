import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Pause,
  Play,
  SkipForward,
  Square,
  Archive,
  Edit2,
  Check,
  X,
  Tag,
  Link2,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react"
import { usePomodoro } from "@/features/pomodoro/hooks/usePomodoro"
import {
  useActiveSession,
  useSessionRecords,
  useSessionTitle,
  useUpdateSessionNote,
  useArchiveSession,
  useAdjustedTimes,
  useSaveAdjustedTimes,
  useAddSessionTodoLinkMutation,
} from "@/features/pomodoro/hooks"
import { TimeAdjustmentDialog } from "./time-adjustment-dialog"
import { SessionTodoLinkSelector } from "./session-todo-link-selector"
import { SessionHistoryList } from "./session-history-list"
import { TagSelector } from "@/features/tag/components"
import { useSessionTagsQuery, useSetSessionTagsMutation } from "@/features/tag/api"
import { TreeIllustration, ProgressRing, MountainBackground } from "@/features/focus-timer/components/forest-illustrations"
import { CoinDisplay } from "@/features/achievement"
import { cn } from "@/lib/utils"

interface PomodoroTimerProps {
  initialTodoId?: number | null
  onFocusStarted?: () => void
}

export function ForestPomodoroTimer({ initialTodoId, onFocusStarted }: PomodoroTimerProps = {}) {
  const { status, isBusy, start, pause, resume, skip, stop, display } = usePomodoro()
  const { data: activeSession, isLoading: sessionLoading } = useActiveSession()
  const { data: sessionRecords } = useSessionRecords(activeSession?.id ?? 0)
  const { data: sessionTitle } = useSessionTitle(activeSession?.id ?? 0)
  const { data: adjustedTimes } = useAdjustedTimes()

  const updateNoteMutation = useUpdateSessionNote()
  const archiveSessionMutation = useArchiveSession()
  const saveAdjustedTimesMutation = useSaveAdjustedTimes()
  const addTodoLinkMutation = useAddSessionTodoLinkMutation()

  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState("")
  const [pendingNote, setPendingNote] = useState<string | null>(null)
  const [pendingTagIds, setPendingTagIds] = useState<number[]>([])
  const [pendingTodoIds, setPendingTodoIds] = useState<number[]>([])
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [adjustType, setAdjustType] = useState<"focus" | "rest">("focus")
  const [isAutoTransition, setIsAutoTransition] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [showSessionDetails, setShowSessionDetails] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const previousModeRef = useRef<string | null>(null)
  const prevHasRealSessionRef = useRef(false)
  const countdownTimerRef = useRef<number | null>(null)

  const hasRealSession = activeSession && (sessionRecords?.length ?? 0) > 0
  const displayNote = hasRealSession ? activeSession?.note : pendingNote
  const displayTitle = hasRealSession ? (sessionTitle || "当前会话") : "新会话"

  const { data: sessionTags = [] } = useSessionTagsQuery(activeSession?.id ?? 0)
  const setSessionTagsMutation = useSetSessionTagsMutation()

  const displayTagIds = useMemo(() => {
    if (hasRealSession) {
      return sessionTags.map((t) => t.id)
    }
    return pendingTagIds
  }, [hasRealSession, sessionTags, pendingTagIds])

  const handleTodoIdsChange = useCallback((todoIds: number[]) => {
    setPendingTodoIds(todoIds)
  }, [])

  useEffect(() => {
    const syncPendingData = async () => {
      if (hasRealSession && !prevHasRealSessionRef.current && activeSession) {
        if (pendingTagIds.length > 0) {
          setSessionTagsMutation.mutate({ sessionId: activeSession.id, tagIds: pendingTagIds })
          setPendingTagIds([])
        }
        if (pendingTodoIds.length > 0) {
          for (const todoId of pendingTodoIds) {
            addTodoLinkMutation.mutate({ sessionId: activeSession.id, todoId })
          }
          setPendingTodoIds([])
        }
      }
    }
    void syncPendingData()
    prevHasRealSessionRef.current = !!hasRealSession
  }, [hasRealSession, activeSession, pendingTagIds, pendingTodoIds, setSessionTagsMutation, addTodoLinkMutation])

  const handleTagsChange = useCallback(
    (tagIds: number[]) => {
      if (hasRealSession && activeSession) {
        setSessionTagsMutation.mutate({ sessionId: activeSession.id, tagIds })
      } else {
        setPendingTagIds(tagIds)
      }
    },
    [hasRealSession, activeSession, setSessionTagsMutation]
  )

  const initialTodoProcessedRef = useRef(false)
  useEffect(() => {
    const handleInitialTodo = async () => {
      if (!initialTodoId || initialTodoProcessedRef.current) return
      initialTodoProcessedRef.current = true
      if (hasRealSession && activeSession) {
        await archiveSessionMutation.mutateAsync(activeSession.id)
      }
      setPendingTodoIds([initialTodoId])
      await start()
      onFocusStarted?.()
    }
    void handleInitialTodo()
  }, [initialTodoId, hasRealSession, activeSession, archiveSessionMutation, start, onFocusStarted])

  const isRunning = status?.running ?? false
  const isPaused = status?.paused ?? false
  const isFocusMode = status?.mode === "focus"
  const isBreakMode = status?.mode === "short_break" || status?.mode === "long_break"

  // 计算进度百分比
  const totalSeconds = useMemo(() => {
    if (!status) return 0
    if (status.mode === "focus") return (adjustedTimes?.focusMinutes ?? 25) * 60
    if (status.mode === "short_break") return (adjustedTimes?.restMinutes ?? 5) * 60
    if (status.mode === "long_break") return 15 * 60
    return 25 * 60
  }, [status, adjustedTimes])

  const progress = useMemo(() => {
    if (!isRunning || totalSeconds === 0) return 0
    const elapsed = totalSeconds - (status?.remainingSeconds ?? 0)
    return Math.min(100, (elapsed / totalSeconds) * 100)
  }, [isRunning, totalSeconds, status?.remainingSeconds])

  const handleAutoConfirm = async () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setShowAdjustDialog(false)
    setIsAutoTransition(false)
    await resume()
  }

  useEffect(() => {
    if (!status || !isRunning || isPaused) return
    const currentMode = status.mode
    const previousMode = previousModeRef.current
    if (previousMode && previousMode !== "idle" && previousMode !== currentMode && currentMode !== "idle") {
      pause()
      setAdjustType(currentMode === "focus" ? "focus" : "rest")
      setIsAutoTransition(true)
      setCountdown(5)
      setShowAdjustDialog(true)
      let timeLeft = 5
      countdownTimerRef.current = window.setInterval(() => {
        timeLeft -= 1
        setCountdown(timeLeft)
        if (timeLeft <= 0) void handleAutoConfirm()
      }, 1000)
    }
    previousModeRef.current = currentMode
  }, [status?.mode, isRunning, isPaused, pause, resume])

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
    }
  }, [])

  const handleEditNote = () => {
    setNoteValue(displayNote ?? "")
    setIsEditingNote(true)
  }

  const handleSaveNote = () => {
    if (hasRealSession && activeSession) {
      updateNoteMutation.mutate(
        { sessionId: activeSession.id, note: noteValue || null },
        { onSuccess: () => setIsEditingNote(false) }
      )
    } else {
      setPendingNote(noteValue || null)
      setIsEditingNote(false)
    }
  }

  const handleCancelEditNote = () => {
    setIsEditingNote(false)
    setNoteValue("")
  }

  const handleArchive = () => {
    if (activeSession && !isRunning) {
      archiveSessionMutation.mutate(activeSession.id)
    }
  }

  const handleAdjustTime = (type: "focus" | "rest") => {
    setAdjustType(type)
    setShowAdjustDialog(true)
  }

  const handleConfirmTime = async (minutes: number) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setIsAutoTransition(false)
    try {
      if (!hasRealSession && pendingNote) {
        await invoke("pomodoro_get_or_create_active_session", { pendingNote })
        setPendingNote(null)
      }
      if (adjustType === "focus") {
        await saveAdjustedTimesMutation.mutateAsync({ focusMinutes: minutes })
        const currentConfig = await invoke<{
          focusMinutes: number
          shortBreakMinutes: number
          longBreakMinutes: number
          longBreakInterval: number
        }>("pomodoro_get_config")
        await invoke("pomodoro_set_config", {
          config: { ...currentConfig, focusMinutes: minutes },
        })
      } else {
        await saveAdjustedTimesMutation.mutateAsync({ restMinutes: minutes })
        const currentConfig = await invoke<{
          focusMinutes: number
          shortBreakMinutes: number
          longBreakMinutes: number
          longBreakInterval: number
        }>("pomodoro_get_config")
        await invoke("pomodoro_set_config", {
          config: { ...currentConfig, shortBreakMinutes: minutes },
        })
      }
      if (isAutoTransition) {
        await resume()
      } else {
        await start()
      }
    } catch (error) {
      console.error("Failed to start pomodoro:", error)
    }
  }

  const handleDialogClose = (open: boolean) => {
    if (!open && isAutoTransition) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
      setIsAutoTransition(false)
      resume()
    }
    setShowAdjustDialog(open)
  }

  // 获取树的变体
  const treeVariant = useMemo(() => {
    if (!isRunning) return "full"
    if (isPaused) return "withered"
    return "growing"
  }, [isRunning, isPaused])

  // 模式标签颜色
  const getModeColor = () => {
    if (isFocusMode) return "bg-primary text-primary-foreground"
    if (isBreakMode) return "bg-emerald-500 text-white"
    return "bg-muted text-muted-foreground"
  }

  return (
    <div className="flex h-full flex-col -mx-6 -my-10">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-xs", getModeColor())}>
            {display.modeLabel}
          </Badge>
          {isRunning && (
            <span className="text-xs text-muted-foreground">
              第 {status?.round ?? 0} 轮
            </span>
          )}
        </div>
        <CoinDisplay showLabel={false} />
      </div>

      {/* 主内容区域 */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {/* 视觉焦点区域 - Forest 风格 */}
          <div className="relative flex flex-col items-center justify-center py-8 overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
            {/* 背景山脉装饰 */}
            <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none">
              <MountainBackground />
            </div>

            {/* 进度环 + 树 */}
            <ProgressRing progress={progress} size={220} strokeWidth={6} className="relative z-10">
              <div className="flex flex-col items-center">
                <TreeIllustration
                  variant={treeVariant}
                  progress={progress}
                  className="w-28 h-32 mb-2"
                />
              </div>
            </ProgressRing>

            {/* 时间显示 */}
            <div className="mt-4 text-center relative z-10">
              <div className="text-5xl font-bold tabular-nums tracking-tight text-foreground">
                {display.timeText}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {isRunning ? (isPaused ? "已暂停" : "专注中...") : "准备开始"}
              </p>
            </div>
          </div>

          {/* 控制按钮区域 */}
          <div className="px-5 py-6 space-y-4">
            {/* 主控制按钮 */}
            <div className="flex justify-center gap-3">
              {!isRunning ? (
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg rounded-full shadow-lg hover:shadow-xl transition-all"
                  onClick={() => handleAdjustTime("focus")}
                  disabled={isBusy || sessionLoading}
                >
                  <Play className="size-5 mr-2" />
                  开始专注
                </Button>
              ) : isPaused ? (
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg rounded-full shadow-lg"
                  onClick={() => resume()}
                  disabled={isBusy}
                >
                  <Play className="size-5 mr-2" />
                  继续
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg rounded-full shadow-lg"
                  onClick={() => pause()}
                  disabled={isBusy}
                >
                  <Pause className="size-5 mr-2" />
                  暂停
                </Button>
              )}
            </div>

            {/* 次要控制按钮 */}
            {isRunning && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => skip()}
                  disabled={isBusy}
                >
                  <SkipForward className="size-4 mr-1" />
                  跳过
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-destructive hover:text-destructive"
                  onClick={() => stop()}
                  disabled={isBusy}
                >
                  <Square className="size-4 mr-1" />
                  放弃
                </Button>
              </div>
            )}
          </div>

          {/* 会话详情折叠区域 */}
          <div className="border-t">
            <button
              onClick={() => setShowSessionDetails(!showSessionDetails)}
              className="flex items-center justify-between w-full px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Edit2 className="size-4" />
                {displayTitle}
                {(sessionRecords?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {sessionRecords?.length} 记录
                  </Badge>
                )}
              </span>
              {showSessionDetails ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>

            {showSessionDetails && (
              <div className="px-5 pb-4 space-y-4">
                {/* 归档按钮 */}
                {activeSession && !activeSession.archived && !isRunning && hasRealSession && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleArchive}
                    disabled={archiveSessionMutation.isPending}
                    className="w-full"
                  >
                    <Archive className="size-4 mr-2" />
                    归档并新建会话
                  </Button>
                )}

                {/* 关联待办 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Link2 className="size-4" />
                    关联待办
                  </label>
                  {hasRealSession && activeSession ? (
                    <SessionTodoLinkSelector sessionId={activeSession.id} />
                  ) : (
                    <SessionTodoLinkSelector
                      sessionId={0}
                      pendingTodoIds={pendingTodoIds}
                      onPendingChange={handleTodoIdsChange}
                    />
                  )}
                </div>

                {/* 标签 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Tag className="size-4" />
                    标签
                  </label>
                  <TagSelector selectedTagIds={displayTagIds} onTagsChange={handleTagsChange} />
                </div>

                {/* 备注 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Edit2 className="size-4" />
                    备注
                  </label>
                  {isEditingNote ? (
                    <div className="space-y-2">
                      <Textarea
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        placeholder="添加备注..."
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveNote} disabled={updateNoteMutation.isPending}>
                          <Check className="size-4 mr-1" />
                          保存
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEditNote}>
                          <X className="size-4 mr-1" />
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : displayNote ? (
                    <div className="flex items-start justify-between gap-2 p-3 rounded-lg bg-muted/50 border">
                      <p className="text-sm text-muted-foreground flex-1">{displayNote}</p>
                      <Button size="sm" variant="ghost" onClick={handleEditNote} className="h-6 w-6 p-0">
                        <Edit2 className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleEditNote} className="w-full">
                      <Edit2 className="size-4 mr-1" />
                      添加备注
                    </Button>
                  )}
                </div>

                {/* 本会话记录 */}
                {sessionRecords && sessionRecords.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">本会话记录</label>
                    <div className="space-y-1">
                      {sessionRecords.map((record, index) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{index + 1}</span>
                            <Badge variant={record.kind === "focus" ? "default" : "secondary"} className="text-xs">
                              {record.kind === "focus" ? "专注" : "休息"}
                            </Badge>
                            <Badge
                              variant={
                                record.status === "completed"
                                  ? "default"
                                  : record.status === "skipped"
                                  ? "secondary"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {record.status === "completed" ? "完成" : record.status === "skipped" ? "跳过" : "停止"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {Math.floor(record.elapsed_seconds / 60)}分{record.elapsed_seconds % 60}秒
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 历史记录折叠区域 */}
          <div className="border-t">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <History className="size-4" />
                历史会话
              </span>
              {showHistory ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            {showHistory && (
              <div className="px-5 pb-4">
                <SessionHistoryList excludeSessionId={activeSession?.id} />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Time Adjustment Dialog */}
      <TimeAdjustmentDialog
        open={showAdjustDialog}
        onOpenChange={handleDialogClose}
        type={adjustType}
        defaultMinutes={
          adjustType === "focus"
            ? adjustedTimes?.focusMinutes ?? 25
            : adjustedTimes?.restMinutes ?? 5
        }
        onConfirm={handleConfirmTime}
        countdown={isAutoTransition ? countdown : undefined}
        isAutoTransition={isAutoTransition}
      />
    </div>
  )
}
