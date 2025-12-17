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
import { SessionTodoLinkSelector } from "./session-todo-link-selector"
import { SessionHistoryList } from "./session-history-list"
import { TagSelector } from "@/features/tag/components"
import { useSessionTagsQuery, useSetSessionTagsMutation } from "@/features/tag/api"
import { CatIllustration, ProgressRing, DurationSlider, PawPrints } from "@/features/focus-timer/components/forest-illustrations"
import { CoinDisplay } from "@/features/achievement"
import { cn } from "@/lib/utils"

interface PomodoroTimerProps {
  initialTodoId?: number | null
  onFocusStarted?: () => void
}

export function CatPomodoroTimer({ initialTodoId, onFocusStarted }: PomodoroTimerProps = {}) {
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
  const [showMore, setShowMore] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false) // 一轮结束后等待用户确认
  
  // 时长控制
  const [focusDuration, setFocusDuration] = useState(adjustedTimes?.focusMinutes ?? 25)
  const [restDuration, setRestDuration] = useState(adjustedTimes?.restMinutes ?? 5)

  const previousModeRef = useRef<string | null>(null)
  const prevHasRealSessionRef = useRef(false)

  const hasRealSession = activeSession && (sessionRecords?.length ?? 0) > 0
  const displayNote = hasRealSession ? activeSession?.note : pendingNote
  const displayTitle = hasRealSession ? (sessionTitle || "当前会话") : "新会话"

  const { data: sessionTags = [] } = useSessionTagsQuery(activeSession?.id ?? 0)
  const setSessionTagsMutation = useSetSessionTagsMutation()

  // 同步 adjustedTimes 到本地状态
  useEffect(() => {
    if (adjustedTimes) {
      if (adjustedTimes.focusMinutes != null) {
        setFocusDuration(adjustedTimes.focusMinutes)
      }
      if (adjustedTimes.restMinutes != null) {
        setRestDuration(adjustedTimes.restMinutes)
      }
    }
  }, [adjustedTimes])

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
      await handleStartFocus()
      onFocusStarted?.()
    }
    void handleInitialTodo()
  }, [initialTodoId])

  const isRunning = status?.running ?? false
  const isPaused = status?.paused ?? false
  const isFocusMode = status?.mode === "focus"
  const isBreakMode = status?.mode === "short_break" || status?.mode === "long_break"

  // 计算进度百分比
  const totalSeconds = useMemo(() => {
    if (!status) return 0
    if (status.mode === "focus") return focusDuration * 60
    if (status.mode === "short_break") return restDuration * 60
    if (status.mode === "long_break") return 15 * 60
    return focusDuration * 60
  }, [status, focusDuration, restDuration])

  const progress = useMemo(() => {
    if (!isRunning || totalSeconds === 0) return 0
    const elapsed = totalSeconds - (status?.remainingSeconds ?? 0)
    return Math.min(100, (elapsed / totalSeconds) * 100)
  }, [isRunning, totalSeconds, status?.remainingSeconds])

  // 模式切换时暂停并等待用户确认新时长
  useEffect(() => {
    if (!status) return
    const currentMode = status.mode
    const previousMode = previousModeRef.current
    
    // 检测模式切换（专注→休息 或 休息→专注）
    if (previousMode && previousMode !== "idle" && previousMode !== currentMode && currentMode !== "idle") {
      // 一轮结束，暂停并显示时间设置
      setAwaitingConfirmation(true)
      void pause()
    }
    
    previousModeRef.current = currentMode
  }, [status?.mode, pause])

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

  const handleStartFocus = async () => {
    try {
      await saveAdjustedTimesMutation.mutateAsync({ focusMinutes: focusDuration })
      const currentConfig = await invoke<{
        focusMinutes: number
        shortBreakMinutes: number
        longBreakMinutes: number
        longBreakInterval: number
      }>("pomodoro_get_config")
      await invoke("pomodoro_set_config", {
        config: { ...currentConfig, focusMinutes: focusDuration, shortBreakMinutes: restDuration },
      })
      
      if (!hasRealSession && pendingNote) {
        await invoke("pomodoro_get_or_create_active_session", { pendingNote })
        setPendingNote(null)
      }
      
      await start()
      setAwaitingConfirmation(false)
    } catch (error) {
      console.error("Failed to start pomodoro:", error)
    }
  }

  // 确认继续下一轮（一轮结束后用户确认）
  const handleConfirmContinue = async () => {
    try {
      // 根据当前模式保存对应时长
      if (status?.mode === "focus") {
        await saveAdjustedTimesMutation.mutateAsync({ focusMinutes: focusDuration })
      } else {
        await saveAdjustedTimesMutation.mutateAsync({ restMinutes: restDuration })
      }
      
      const currentConfig = await invoke<{
        focusMinutes: number
        shortBreakMinutes: number
        longBreakMinutes: number
        longBreakInterval: number
      }>("pomodoro_get_config")
      await invoke("pomodoro_set_config", {
        config: { ...currentConfig, focusMinutes: focusDuration, shortBreakMinutes: restDuration },
      })
      
      setAwaitingConfirmation(false)
      await resume()
    } catch (error) {
      console.error("Failed to continue:", error)
    }
  }

  // 获取猫猫的变体
  const catVariant = useMemo(() => {
    if (!isRunning) return "idle"
    if (isPaused) return "sad"
    if (isBreakMode) return "sleeping"
    return "focusing"
  }, [isRunning, isPaused, isBreakMode])

  // 模式标签颜色
  const getModeColor = () => {
    if (isFocusMode) return "bg-primary text-primary-foreground"
    if (isBreakMode) return "bg-emerald-500 text-white"
    return "bg-muted text-muted-foreground"
  }

  // 状态文本
  const getStatusText = () => {
    if (!isRunning) return "设置时长后开始专注吧~"
    if (isPaused) return "喵呜...主人暂停了"
    if (isBreakMode) return "休息一下吧~"
    return "喵~ 专注中..."
  }

  return (
    <div className="flex h-full flex-col -mx-6 -my-10">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background/80 backdrop-blur-sm">
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
          {/* 视觉焦点区域 */}
          <div className="relative flex flex-col items-center justify-center py-4 overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
            {/* 爪印装饰 */}
            <div className="absolute top-2 left-0 right-0 h-8 pointer-events-none opacity-50">
              <PawPrints />
            </div>

            {/* 进度环 + 猫猫 */}
            <ProgressRing progress={progress} size={180} strokeWidth={5} className="relative z-10">
              <CatIllustration
                variant={catVariant}
                progress={progress}
                className="w-28 h-28"
              />
            </ProgressRing>

            {/* 时间显示 */}
            <div className="mt-2 text-center relative z-10">
              <div className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                {display.timeText}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {getStatusText()}
              </p>
            </div>
          </div>

          {/* 时长控制 + 关联设置区域 - 未运行或等待确认时显示 */}
          {(!isRunning || awaitingConfirmation) && (
            <div className="px-4 py-3 space-y-3 border-y bg-muted/20">
              {/* 等待确认提示 */}
              {awaitingConfirmation && (
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                  <span>🎉</span>
                  <span>{status?.mode === "focus" ? "休息结束！准备开始专注" : "专注结束！准备休息"}</span>
                </div>
              )}
              
              {/* 时长控制 - 水平紧凑布局 */}
              <div className="grid grid-cols-2 gap-4">
                <DurationSlider
                  value={focusDuration}
                  onChange={setFocusDuration}
                  min={1}
                  max={120}
                  step={1}
                  color="primary"
                  label="🎯 专注"
                />
                
                <DurationSlider
                  value={restDuration}
                  onChange={setRestDuration}
                  min={1}
                  max={30}
                  step={1}
                  color="emerald"
                  label="☕ 休息"
                />
              </div>

              {/* 关联待办 - 直接显示 */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">🔗 关联待办</span>
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

              {/* 标签 - 直接显示 */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">🏷️ 标签</span>
                <TagSelector selectedTagIds={displayTagIds} onTagsChange={handleTagsChange} />
              </div>
            </div>
          )}

          {/* 控制按钮区域 */}
          <div className="px-4 py-4 space-y-2">
            {/* 主控制按钮 */}
            <div className="flex justify-center gap-3">
              {awaitingConfirmation ? (
                // 等待确认状态 - 显示确认继续按钮
                <Button
                  size="lg"
                  className={cn(
                    "h-12 px-10 text-base rounded-full shadow-lg hover:shadow-xl transition-all",
                    status?.mode === "focus" ? "bg-primary" : "bg-emerald-500 hover:bg-emerald-600"
                  )}
                  onClick={handleConfirmContinue}
                  disabled={isBusy}
                >
                  <Play className="size-5 mr-2" />
                  {status?.mode === "focus" ? "开始专注" : "开始休息"}
                </Button>
              ) : !isRunning ? (
                <Button
                  size="lg"
                  className="h-12 px-10 text-base rounded-full shadow-lg hover:shadow-xl transition-all"
                  onClick={handleStartFocus}
                  disabled={isBusy || sessionLoading}
                >
                  <Play className="size-5 mr-2" />
                  开始专注
                </Button>
              ) : isPaused ? (
                <Button
                  size="lg"
                  className="h-12 px-10 text-base rounded-full shadow-lg"
                  onClick={() => resume()}
                  disabled={isBusy}
                >
                  <Play className="size-5 mr-2" />
                  继续
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="h-12 px-10 text-base rounded-full shadow-lg"
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

          {/* 运行时显示关联信息 */}
          {isRunning && (displayTagIds.length > 0 || pendingTodoIds.length > 0) && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5 justify-center">
              {sessionTags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* 更多选项折叠区域 */}
          <div className="border-t">
            <button
              onClick={() => setShowMore(!showMore)}
              className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Edit2 className="size-3.5" />
                {displayTitle}
                {(sessionRecords?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {sessionRecords?.length} 记录
                  </Badge>
                )}
              </span>
              {showMore ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {showMore && (
              <div className="px-4 pb-3 space-y-3">
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

                {/* 备注 */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">📝 备注</span>
                  {isEditingNote ? (
                    <div className="space-y-2">
                      <Textarea
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        placeholder="添加备注..."
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveNote} disabled={updateNoteMutation.isPending}>
                          <Check className="size-3.5 mr-1" />
                          保存
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEditNote}>
                          <X className="size-3.5 mr-1" />
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : displayNote ? (
                    <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground flex-1">{displayNote}</p>
                      <Button size="sm" variant="ghost" onClick={handleEditNote} className="h-5 w-5 p-0">
                        <Edit2 className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleEditNote} className="w-full h-8 text-xs">
                      <Edit2 className="size-3.5 mr-1" />
                      添加备注
                    </Button>
                  )}
                </div>

                {/* 本会话记录 */}
                {sessionRecords && sessionRecords.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">📊 本会话记录</span>
                    <div className="space-y-1">
                      {sessionRecords.map((record, index) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-muted/30 text-xs"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">#{index + 1}</span>
                            <Badge variant={record.kind === "focus" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
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
                              className="text-[10px] px-1.5 py-0"
                            >
                              {record.status === "completed" ? "完成" : record.status === "skipped" ? "跳过" : "停止"}
                            </Badge>
                          </div>
                          <span className="text-muted-foreground">
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
              className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <History className="size-3.5" />
                历史会话
              </span>
              {showHistory ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            {showHistory && (
              <div className="px-4 pb-3">
                <SessionHistoryList excludeSessionId={activeSession?.id} />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
