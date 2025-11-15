import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as sessionApi from "../api/session.api";

// ==================== Query Keys ====================

export const pomodoroKeys = {
  all: ["pomodoro"] as const,
  sessions: () => [...pomodoroKeys.all, "sessions"] as const,
  session: (id: number) => [...pomodoroKeys.sessions(), id] as const,
  activeSession: () => [...pomodoroKeys.sessions(), "active"] as const,
  sessionRecords: (sessionId: number) => [...pomodoroKeys.session(sessionId), "records"] as const,
  sessionTitle: (sessionId: number) => [...pomodoroKeys.session(sessionId), "title"] as const,
  adjustedTimes: () => [...pomodoroKeys.all, "adjusted-times"] as const,
};

// ==================== Session Queries ====================

/**
 * 获取所有 Sessions
 */
export function useSessions(includeArchived = false) {
  return useQuery({
    queryKey: [...pomodoroKeys.sessions(), includeArchived],
    queryFn: () => sessionApi.listAllSessions(includeArchived),
  });
}

/**
 * 获取指定 Session
 */
export function useSession(sessionId: number) {
  return useQuery({
    queryKey: pomodoroKeys.session(sessionId),
    queryFn: () => sessionApi.getSession(sessionId),
    enabled: sessionId > 0,
  });
}

/**
 * 获取活动 Session（不自动创建）
 */
export function useActiveSession() {
  return useQuery({
    queryKey: pomodoroKeys.activeSession(),
    queryFn: () => sessionApi.getActiveSession(),
  });
}

/**
 * 获取 Session 的所有 Records
 */
export function useSessionRecords(sessionId: number) {
  return useQuery({
    queryKey: pomodoroKeys.sessionRecords(sessionId),
    queryFn: () => sessionApi.listSessionRecords(sessionId),
    enabled: sessionId > 0,
  });
}

/**
 * 获取 Session 动态标题
 */
export function useSessionTitle(sessionId: number) {
  return useQuery({
    queryKey: pomodoroKeys.sessionTitle(sessionId),
    queryFn: () => sessionApi.generateSessionTitle(sessionId),
    enabled: sessionId > 0,
  });
}

/**
 * 获取上次调整的时间配置
 */
export function useAdjustedTimes() {
  return useQuery({
    queryKey: pomodoroKeys.adjustedTimes(),
    queryFn: () => sessionApi.getAdjustedTimes(),
  });
}

// ==================== Session Mutations ====================

/**
 * 创建新 Session
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (note?: string) => sessionApi.createSession(note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pomodoroKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: pomodoroKeys.activeSession() });
    },
  });
}

/**
 * 更新 Session 备注
 */
export function useUpdateSessionNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sessionId, note }: { sessionId: number; note: string | null }) =>
      sessionApi.updateSessionNote(sessionId, note),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pomodoroKeys.session(data.id) });
      queryClient.invalidateQueries({ queryKey: pomodoroKeys.sessions() });
    },
  });
}

/**
 * 归档 Session
 */
export function useArchiveSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (sessionId: number) => sessionApi.archiveSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pomodoroKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: pomodoroKeys.activeSession() });
    },
  });
}

/**
 * 删除 Session（级联删除）
 */
export function useDeleteSessionCascade() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (sessionId: number) => sessionApi.deleteSessionCascade(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pomodoroKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: pomodoroKeys.all });
    },
  });
}

/**
 * 保存调整的时间配置
 */
export function useSaveAdjustedTimes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ focusMinutes, restMinutes }: { focusMinutes?: number; restMinutes?: number }) =>
      sessionApi.saveAdjustedTimes(focusMinutes, restMinutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pomodoroKeys.adjustedTimes() });
    },
  });
}
