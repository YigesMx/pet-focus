import { useQuery } from "@tanstack/react-query";
import { getDailyStats, getOverallStats, generateDateRange } from "@/features/pomodoro/api/stats.api";

// Query key factory
const statsQueryKeys = {
  all: ["pomodoro-stats"] as const,
  daily: (days: number) => [...statsQueryKeys.all, "daily", days] as const,
  overall: () => [...statsQueryKeys.all, "overall"] as const,
};

/**
 * 获取每日统计数据 Hook
 * 默认获取过去 365 天的数据
 */
export function useDailyStats(days: number = 365) {
  const [from, to] = generateDateRange(days);

  return useQuery({
    queryKey: statsQueryKeys.daily(days),
    queryFn: () => getDailyStats(from, to),
    staleTime: 5 * 60 * 1000, // 5 分钟
    gcTime: 30 * 60 * 1000, // 30 分钟
  });
}

/**
 * 获取整体统计信息 Hook
 */
export function useOverallStats() {
  return useQuery({
    queryKey: statsQueryKeys.overall(),
    queryFn: () => getOverallStats(),
    staleTime: 5 * 60 * 1000, // 5 分钟
    gcTime: 30 * 60 * 1000, // 30 分钟
  });
}

/**
 * 获取完整的统计数据 Hook（每日 + 整体）
 */
export function useCompleteStats(days: number = 365) {
  const dailyQuery = useDailyStats(days);
  const overallQuery = useOverallStats();

  return {
    daily: dailyQuery.data ?? [],
    overall: overallQuery.data,
    isLoading: dailyQuery.isLoading || overallQuery.isLoading,
    error: dailyQuery.error || overallQuery.error,
  };
}

// 导出查询键，便于手动清除缓存
export { statsQueryKeys };
