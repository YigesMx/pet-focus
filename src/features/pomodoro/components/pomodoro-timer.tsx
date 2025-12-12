import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Pause, Play, RotateCcw, SkipForward, Square, Archive, Edit2, Check, X, Tag } from "lucide-react"
import { usePomodoro } from "@/features/pomodoro/hooks/usePomodoro"
import {
  useActiveSession,
  useSessionRecords,
  useSessionTitle,
  useUpdateSessionNote,
  useArchiveSession,
  useAdjustedTimes,
  useSaveAdjustedTimes,
} from "@/features/pomodoro/hooks"
import { TimeAdjustmentDialog } from "./time-adjustment-dialog"
import { TagSelector } from "@/features/tag/components"
import { useSessionTagsQuery, useSetSessionTagsMutation } from "@/features/tag/api"

export function PomodoroTimer() {
  const { status, isBusy, start, pause, resume, skip, stop, display } = usePomodoro()
  const { data: activeSession, isLoading: sessionLoading } = useActiveSession()
  const { data: sessionRecords } = useSessionRecords(activeSession?.id ?? 0)
  const { data: sessionTitle } = useSessionTitle(activeSession?.id ?? 0)
  const { data: adjustedTimes } = useAdjustedTimes()
  
  const updateNoteMutation = useUpdateSessionNote()
  const archiveSessionMutation = useArchiveSession()
  const saveAdjustedTimesMutation = useSaveAdjustedTimes()

  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState("")
  const [pendingNote, setPendingNote] = useState<string | null>(null) // 虚拟 session 的备注
  const [pendingTagIds, setPendingTagIds] = useState<number[]>([]) // 虚拟 session 的标签
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [adjustType, setAdjustType] = useState<"focus" | "rest">("focus")
  const [isAutoTransition, setIsAutoTransition] = useState(false)
  const [countdown, setCountdown] = useState(5)
  
  const previousModeRef = useRef<string | null>(null)
  const countdownTimerRef = useRef<number | null>(null)

  // 判断是否有真实 session（有 records 的 session）
  const hasRealSession = activeSession && (sessionRecords?.length ?? 0) > 0
  // 显示的备注：如果有真实 session 用真实备注，否则用 pending 备注
  const displayNote = hasRealSession ? activeSession?.note : pendingNote
  // 显示的标题
  const displayTitle = hasRealSession ? (sessionTitle || "当前会话") : "新会话"

  // 标签相关
  const { data: sessionTags = [] } = useSessionTagsQuery(activeSession?.id ?? 0)
  const setSessionTagsMutation = useSetSessionTagsMutation()

  // 当前显示的标签 IDs
  const displayTagIds = useMemo(() => {
    if (hasRealSession) {
      return sessionTags.map((t) => t.id)
    }
    return pendingTagIds
  }, [hasRealSession, sessionTags, pendingTagIds])

  // 标签变更处理
  const handleTagsChange = useCallback(
    (tagIds: number[]) => {
      if (hasRealSession && activeSession) {
        // 有真实 session，直接更新
        setSessionTagsMutation.mutate({ sessionId: activeSession.id, tagIds })
      } else {
        // 没有真实 session，暂存
        setPendingTagIds(tagIds)
      }
    },
    [hasRealSession, activeSession, setSessionTagsMutation],
  )

  const isRunning = status?.running ?? false
  const isPaused = status?.paused ?? false

  const handleAutoConfirm = async () => {
    // 清理倒计时定时器
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    
    setShowAdjustDialog(false)
    setIsAutoTransition(false)
    
    // 直接恢复计时（使用当前配置的时间）
    await resume()
  }

  // 监听阶段自动切换
  useEffect(() => {
    if (!status || !isRunning || isPaused) {
      return
    }

    const currentMode = status.mode
    const previousMode = previousModeRef.current

    // 检测到阶段切换（从一个非 idle 模式切换到另一个模式）
    if (previousMode && previousMode !== "idle" && previousMode !== currentMode && currentMode !== "idle") {
      // 暂停定时器
      pause()
      
      // 设置对话框类型
      if (currentMode === "focus") {
        setAdjustType("focus")
      } else {
        setAdjustType("rest")
      }
      
      // 标记为自动切换并显示对话框
      setIsAutoTransition(true)
      setCountdown(5)
      setShowAdjustDialog(true)
      
      // 启动倒计时
      let timeLeft = 5
      countdownTimerRef.current = window.setInterval(() => {
        timeLeft -= 1
        setCountdown(timeLeft)
        
        if (timeLeft <= 0) {
          // 倒计时结束，自动继续
          void handleAutoConfirm()
        }
      }, 1000)
    }

    previousModeRef.current = currentMode
  }, [status?.mode, isRunning, isPaused, pause, resume])

  // 清理倒计时定时器
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
    }
  }, [])

  const handleEditNote = () => {
    // 如果有真实 session，编辑真实备注；否则编辑 pending 备注
    setNoteValue(displayNote ?? "")
    setIsEditingNote(true)
  }

  const handleSaveNote = () => {
    if (hasRealSession && activeSession) {
      // 有真实 session，直接更新
      updateNoteMutation.mutate(
        { sessionId: activeSession.id, note: noteValue || null },
        {
          onSuccess: () => setIsEditingNote(false),
        }
      )
    } else {
      // 没有真实 session，暂存到 pendingNote
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
    // 清理倒计时定时器
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    
    setIsAutoTransition(false)
    
    try {
      // 如果没有真实 session 且有 pending note，先创建 session
      if (!hasRealSession && pendingNote) {
        await invoke("pomodoro_get_or_create_active_session", { pendingNote })
        setPendingNote(null) // 清空 pending note
      }
      
      if (adjustType === "focus") {
        // 保存调整的时间
        await saveAdjustedTimesMutation.mutateAsync({ focusMinutes: minutes })
        
        // 获取当前配置
        const currentConfig = await invoke<{
          focusMinutes: number
          shortBreakMinutes: number
          longBreakMinutes: number
          longBreakInterval: number
        }>("pomodoro_get_config")
        
        // 使用调整后的时间临时更新配置
        await invoke("pomodoro_set_config", {
          config: {
            ...currentConfig,
            focusMinutes: minutes,
          },
        })
        
        // 如果是自动切换，恢复计时；否则开始新计时
        if (isAutoTransition) {
          await resume()
        } else {
          await start()
        }
      } else if (adjustType === "rest") {
        // 休息时间调整
        await saveAdjustedTimesMutation.mutateAsync({ restMinutes: minutes })
        
        const currentConfig = await invoke<{
          focusMinutes: number
          shortBreakMinutes: number
          longBreakMinutes: number
          longBreakInterval: number
        }>("pomodoro_get_config")
        
        await invoke("pomodoro_set_config", {
          config: {
            ...currentConfig,
            shortBreakMinutes: minutes,
          },
        })
        
        // 如果是自动切换，恢复计时；否则开始新计时
        if (isAutoTransition) {
          await resume()
        } else {
          await start()
        }
      }
    } catch (error) {
      console.error("Failed to start pomodoro:", error)
    }
  }

  const handleDialogClose = (open: boolean) => {
    if (!open && isAutoTransition) {
      // 如果是自动切换时关闭对话框，清理倒计时并恢复计时
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
      setIsAutoTransition(false)
      resume()
    }
    setShowAdjustDialog(open)
  }

  return (
    <div className="space-y-4">
      {/* Session Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">
                {displayTitle}
                {activeSession?.archived && (
                  <Badge variant="secondary" className="ml-2">
                    已归档
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {sessionRecords?.length ?? 0} 条记录
              </CardDescription>
            </div>
            {activeSession && !activeSession.archived && !isRunning && hasRealSession && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleArchive}
                disabled={archiveSessionMutation.isPending}
              >
                <Archive className="size-4 mr-1" />
                归档并新建
              </Button>
            )}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-4">
          {/* 标签选择区域 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Tag className="size-4" />
              标签
            </Label>
            <TagSelector
              selectedTagIds={displayTagIds}
              onTagsChange={handleTagsChange}
            />
          </div>

          {/* 备注区域 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Edit2 className="size-4" />
              备注
            </Label>
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
              <div className="flex items-start justify-between gap-2 p-3 rounded-md bg-muted/50">
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
        </CardContent>
      </Card>

      {/* Timer Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">番茄钟</CardTitle>
          <CardDescription>
            {display.modeLabel} {isRunning ? (isPaused ? "(已暂停)" : "进行中") : "(空闲)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="py-8 text-center">
            <div className="text-7xl font-bold tabular-nums text-primary">{display.timeText}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {status ? `第 ${status.round || 0} 轮` : "尚未开始"}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {!isRunning ? (
              <Button 
                size="lg" 
                className="min-w-32 gap-2" 
                onClick={() => handleAdjustTime("focus")} 
                disabled={isBusy || sessionLoading}
              >
                <Play className="size-4" /> 开始专注
              </Button>
            ) : isPaused ? (
              <Button size="lg" className="min-w-32 gap-2" onClick={() => resume()} disabled={isBusy}>
                <Play className="size-4" /> 继续
              </Button>
            ) : (
              <Button size="lg" className="min-w-32 gap-2" onClick={() => pause()} disabled={isBusy}>
                <Pause className="size-4" /> 暂停
              </Button>
            )}

            <Button size="lg" variant="outline" className="min-w-32 gap-2" onClick={() => skip()} disabled={!isRunning || isBusy}>
              <SkipForward className="size-4" /> 跳过
            </Button>

            <Button size="lg" variant="outline" className="min-w-32 gap-2" onClick={() => stop()} disabled={!isRunning || isBusy}>
              <Square className="size-4" /> 停止
            </Button>

            <Button 
              size="lg" 
              variant="ghost" 
              className="min-w-32 gap-2" 
              onClick={() => handleAdjustTime("focus")} 
              disabled={isBusy || sessionLoading}
            >
              <RotateCcw className="size-4" /> 重置并开始
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session Records */}
      {sessionRecords && sessionRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">本会话记录</CardTitle>
            <CardDescription>{sessionRecords.length} 条记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessionRecords.map((record, index) => (
                <div key={record.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">#{index + 1}</span>
                    <Badge variant={record.kind === "focus" ? "default" : "secondary"}>
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
                    >
                      {record.status === "completed" ? "完成" : record.status === "skipped" ? "跳过" : "停止"}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {Math.floor(record.elapsed_seconds / 60)}分{record.elapsed_seconds % 60}秒
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Adjustment Dialog */}
      <TimeAdjustmentDialog
        open={showAdjustDialog}
        onOpenChange={handleDialogClose}
        type={adjustType}
        defaultMinutes={
          adjustType === "focus"
            ? adjustedTimes?.focusMinutes ?? 25
            : adjustType === "rest"
            ? adjustedTimes?.restMinutes ?? 5
            : 25
        }
        onConfirm={handleConfirmTime}
        countdown={isAutoTransition ? countdown : undefined}
        isAutoTransition={isAutoTransition}
      />
    </div>
  )
}

