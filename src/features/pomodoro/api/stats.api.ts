import { invoke } from "@tauri-apps/api/core";

// ==================== Types ====================

export interface DailyStat {
  /** 日期 (YYYY-MM-DD) */
  date: string;
  /** 该日期的专注总秒数 */
  focusSeconds: number;
  /** 该日期的会话数（去重后） */
  sessionCount: number;
  /** 该日期的专注记录数 */
  recordCount: number;
}

export interface OverallStats {
  /** 总专注秒数 */
  totalFocusSeconds: number;
  /** 总会话数 */
  totalSessions: number;
  /** 总记录数 */
  totalRecords: number;
  /** 平均每天的专注秒数 */
  avgSecondsPerDay: number;
  /** 最长连续活动天数 */
  longestStreak: number;
  /** 当前连续活动天数 */
  currentStreak: number;
}

// ==================== API Functions ====================

/**
 * 获取指定日期范围内的每日统计数据（用于砖墙展示）
 * @param from 开始日期 (ISO 8601 格式)
 * @param to 结束日期 (ISO 8601 格式)
 */
export async function getDailyStats(from: string, to: string): Promise<DailyStat[]> {
  return await invoke<DailyStat[]>("pomodoro_get_daily_stats", {
    payload: { from, to },
  });
}

/**
 * 获取整体统计信息
 */
export async function getOverallStats(): Promise<OverallStats> {
  return await invoke<OverallStats>("pomodoro_get_overall_stats");
}

/**
 * 辅助函数：生成过去 N 天的日期范围（用于砖墙）
 * @param days 天数（默认 52 周 = 365 天）
 */
export function generateDateRange(days: number = 365): [string, string] {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  return [from.toISOString(), to.toISOString()];
}

/**
 * 辅助函数：计算某个日期相对于今天的偏移（用于砖墙位置计算）
 */
export function getDaysSinceToday(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - targetDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 辅助函数：根据专注秒数计算活动强度等级（0-4）
 * 用于砖墙颜色渐变
 */
export function getActivityLevel(focusSeconds: number): 0 | 1 | 2 | 3 | 4 {
  if (focusSeconds === 0) return 0;
  if (focusSeconds < 1800) return 1; // < 30 分钟
  if (focusSeconds < 3600) return 2; // < 1 小时
  if (focusSeconds < 7200) return 3; // < 2 小时
  return 4; // >= 2 小时
}
