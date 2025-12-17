import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { listen } from "@tauri-apps/api/event"
import {
  getUserStats,
  listAchievements,
  listCoinTransactions,
  type UserStats,
} from "../api"

// ==================== Query Keys ====================

export const achievementKeys = {
  all: ["achievement"] as const,
  stats: () => [...achievementKeys.all, "stats"] as const,
  achievements: () => [...achievementKeys.all, "list"] as const,
  transactions: (limit?: number) => [...achievementKeys.all, "transactions", limit] as const,
}

// ==================== Hooks ====================

/**
 * 获取用户统计数据
 */
export function useUserStats() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // 监听统计数据更新事件
    const unlisten = listen<UserStats>("achievement-stats-updated", (event) => {
      queryClient.setQueryData(achievementKeys.stats(), event.payload)
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [queryClient])

  return useQuery({
    queryKey: achievementKeys.stats(),
    queryFn: getUserStats,
  })
}

/**
 * 获取当前金币数量（从统计数据中获取）
 */
export function useCoins() {
  const { data: stats } = useUserStats()
  return stats?.coins ?? 0
}

/**
 * 获取成就列表
 */
export function useAchievements() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // 监听成就解锁事件，刷新列表
    const unlisten = listen("achievement-unlocked", () => {
      queryClient.invalidateQueries({ queryKey: achievementKeys.achievements() })
      queryClient.invalidateQueries({ queryKey: achievementKeys.stats() })
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [queryClient])

  return useQuery({
    queryKey: achievementKeys.achievements(),
    queryFn: listAchievements,
  })
}

/**
 * 获取金币交易记录
 */
export function useCoinTransactions(limit?: number) {
  const queryClient = useQueryClient()

  useEffect(() => {
    // 监听金币变化事件，刷新交易记录
    const unlisten = listen("achievement-coins-changed", () => {
      queryClient.invalidateQueries({ queryKey: achievementKeys.transactions() })
      queryClient.invalidateQueries({ queryKey: achievementKeys.stats() })
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [queryClient])

  return useQuery({
    queryKey: achievementKeys.transactions(limit),
    queryFn: () => listCoinTransactions(limit),
  })
}

/**
 * 获取解锁的成就数量
 */
export function useUnlockedAchievementCount() {
  const { data: achievements } = useAchievements()
  return achievements?.filter((a) => a.unlocked).length ?? 0
}

/**
 * 获取成就完成进度
 */
export function useAchievementProgress() {
  const { data: achievements } = useAchievements()
  const total = achievements?.length ?? 0
  const unlocked = achievements?.filter((a) => a.unlocked).length ?? 0
  return { total, unlocked, percentage: total > 0 ? (unlocked / total) * 100 : 0 }
}
