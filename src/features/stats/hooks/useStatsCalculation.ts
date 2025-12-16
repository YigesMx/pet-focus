/**
 * 统计计算和管理 Hook
 */

import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { listAllSessions, listSessionRecords } from "@/features/pomodoro/api/session.api"
import {
  calculateDayStats,
  calculateMonthStats,
  calculateOverallStats,
  buildSessionIndex,
  calculateWeekStats,
  calculateComparison,
} from "../lib/statsCalculator"
import { getCache, setCache, createNewCacheData, updateMonthlyStats, updateOverallStats } from "../lib/cacheStorage"
import type {
  DayStats,
  StatsQueryOptions,
} from "../types/stats"

/**
 * 统计计算主 Hook
 * 负责从后端加载数据、计算统计、管理缓存
 */
export function useStatsCalculation() {
  // 获取所有 Sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["pomodoro:sessions:all"],
    queryFn: () => listAllSessions(true),
    staleTime: 5 * 60 * 1000, // 5 分钟
  })

  // 获取所有 Records
  const { data: allRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["pomodoro:records:all", sessions.map((s) => s.id).join(",")],
    queryFn: async () => {
      const recordsMap: Record<number, any[]> = {}
      const results = await Promise.all(
        sessions.map(async (session) => {
          const records = await listSessionRecords(session.id)
          recordsMap[session.id] = records
          return records
        })
      )
      return results.flat()
    },
    enabled: sessions.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  // 计算和缓存统计数据
  const stats = useMemo(() => {
    if (sessionsLoading || recordsLoading || allRecords.length === 0) {
      return null
    }

    try {
      // 尝试从缓存读取
      let cacheData = getCache()
      const needsUpdate = !cacheData

      if (!cacheData) {
        cacheData = createNewCacheData()
      }

      if (needsUpdate) {
        // 构建索引
        cacheData.sessionIndex = buildSessionIndex(allRecords)

        // 按月分组计算
        const monthsSet = new Set<string>()
        allRecords.forEach((r) => {
          const month = r.start_at.substring(0, 7)
          monthsSet.add(month)
        })

        monthsSet.forEach((month) => {
          const monthStats = calculateMonthStats(allRecords, month)
          updateMonthlyStats(cacheData!, month, monthStats)
        })

        // 计算总体统计
        const overallStats = calculateOverallStats(sessions, allRecords)
        updateOverallStats(cacheData!, overallStats)

        // 保存到缓存
        setCache(cacheData!)
      }

      return {
        ...cacheData!.overallStats,
        monthlyStats: cacheData!.monthlyStats,
        sessionIndex: cacheData!.sessionIndex,
        cachedAt: new Date(cacheData!.lastUpdateTime),
      }
    } catch (error) {
      console.error("Failed to calculate stats:", error)
      return null
    }
  }, [allRecords, sessions, sessionsLoading, recordsLoading])

  return {
    stats,
    isLoading: sessionsLoading || recordsLoading,
    isError: allRecords.length === 0 && !sessionsLoading && !recordsLoading && sessions.length > 0,
  }
}

/**
 * 获取月份的统计数据 Hook
 * 即使该月没有任何记录，也会返回完整的月份结构（所有日期）
 */
export function useMonthStats(yearMonth: string) {
  // 获取所有 Sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ["pomodoro:sessions:all"],
    queryFn: () => listAllSessions(true),
    staleTime: 5 * 60 * 1000,
  })

  // 获取所有 Records
  const { data: allRecords = [] } = useQuery({
    queryKey: ["pomodoro:records:all", sessions.map((s) => s.id).join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        sessions.map(async (session) => {
          const records = await listSessionRecords(session.id)
          return records
        })
      )
      return results.flat()
    },
    enabled: sessions.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  // 直接计算请求月份的统计（即使没有记录也会返回完整月份结构）
  const monthStats = useMemo(() => {
    return calculateMonthStats(allRecords, yearMonth)
  }, [allRecords, yearMonth])

  return monthStats
}

/**
 * 获取日级统计数据 Hook
 */
export function useDayStats(dateStr: string) {
  const { data: allRecords = [] } = useQuery({
    queryKey: ["pomodoro:records:all"],
    queryFn: async () => {
      const sessions = await listAllSessions(true)
      const records = await Promise.all(sessions.map((s) => listSessionRecords(s.id)))
      return records.flat()
    },
    staleTime: 5 * 60 * 1000,
  })

  const dayStats = useMemo(() => {
    if (allRecords.length === 0) return null
    return calculateDayStats(allRecords, dateStr)
  }, [allRecords, dateStr])

  return dayStats
}

/**
 * 获取周级统计数据 Hook
 */
export function useWeekStats(startDate: string) {
  const { data: allRecords = [] } = useQuery({
    queryKey: ["pomodoro:records:all"],
    queryFn: async () => {
      const sessions = await listAllSessions(true)
      const records = await Promise.all(sessions.map((s) => listSessionRecords(s.id)))
      return records.flat()
    },
    staleTime: 5 * 60 * 1000,
  })

  const weekStats = useMemo(() => {
    if (allRecords.length === 0) return null
    return calculateWeekStats(allRecords, startDate)
  }, [allRecords, startDate])

  return weekStats
}

/**
 * 获取对比分析数据 Hook
 */
export function useComparisonData(referenceDate?: Date) {
  const { data: allRecords = [] } = useQuery({
    queryKey: ["pomodoro:records:all"],
    queryFn: async () => {
      const sessions = await listAllSessions(true)
      const records = await Promise.all(sessions.map((s) => listSessionRecords(s.id)))
      return records.flat()
    },
    staleTime: 5 * 60 * 1000,
  })

  const comparisonData = useMemo(() => {
    if (allRecords.length === 0) return null
    return calculateComparison(allRecords, referenceDate)
  }, [allRecords, referenceDate])

  return comparisonData
}

/**
 * 获取连续打卡天数 Hook
 */
export function useStreakData() {
  const { stats } = useStatsCalculation()

  return useMemo(() => {
    if (!stats) return null
    return {
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
    }
  }, [stats])
}

/**
 * 强制刷新统计数据 Hook
 */
export function useRefreshStats() {
  const { refetch: refetchSessions } = useQuery({
    queryKey: ["pomodoro:sessions:all"],
    queryFn: () => listAllSessions(true),
  })

  const refresh = useCallback(async () => {
    try {
      // 刷新数据
      await refetchSessions()
      // 缓存会自动失效并重新计算
      return true
    } catch (error) {
      console.error("Failed to refresh stats:", error)
      return false
    }
  }, [refetchSessions])

  return refresh
}

/**
 * 按查询条件获取统计数据 Hook
 */
export function useFilteredStats(options: StatsQueryOptions) {
  const { stats } = useStatsCalculation()

  const filteredStats = useMemo(() => {
    if (!stats || !stats.monthlyStats) return []

    const allDays: DayStats[] = []

    // 收集所有相关月份的数据
    Object.entries(stats.monthlyStats).forEach(([, monthStats]) => {
      if (options.yearMonth && monthStats.yearMonth !== options.yearMonth) return
      if (options.year && !monthStats.yearMonth.startsWith(String(options.year))) return

      allDays.push(...monthStats.days)
    })

    // 按日期排序
    allDays.sort((a, b) => a.timestamp - b.timestamp)

    // 应用日期范围过滤
    let filtered = allDays
    if (options.startDate) {
      filtered = filtered.filter((d) => d.date >= options.startDate!)
    }
    if (options.endDate) {
      filtered = filtered.filter((d) => d.date <= options.endDate!)
    }

    return filtered
  }, [stats, options])

  return filteredStats
}
