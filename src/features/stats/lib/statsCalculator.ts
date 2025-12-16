/**
 * 核心统计计算算法
 */

import type { PomodoroSession, PomodoroRecord } from "@/features/pomodoro/api/session.api"
import type {
  DayStats,
  MonthStats,
  OverallStats,
  SessionIndexEntry,
  WeekStats,
  StatsQueryOptions,
  ComparisonData,
} from "../types/stats"

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date | string): string {
  if (typeof date === "string") {
    return date.split("T")[0]
  }
  return date.toISOString().split("T")[0]
}

/**
 * 格式化为年月 YYYY-MM
 */
function formatYearMonth(date: Date | string): string {
  const dateStr = formatDate(date)
  return dateStr.substring(0, 7)
}

/**
 * 获取日期的时间戳（毫秒）
 */
function getDateTimestamp(date: Date | string): number {
  const dateStr = formatDate(date)
  return new Date(dateStr).getTime()
}

/**
 * 检查两个日期是否是同一天
 */
function isSameDay(date1: string, date2: string): boolean {
  return formatDate(date1) === formatDate(date2)
}

/**
 * 检查两个日期是否相邻（相差 1 天）
 */
function isAdjacent(date1: string, date2: string): boolean {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diff = Math.abs(d1.getTime() - d2.getTime())
  return diff === 24 * 60 * 60 * 1000
}

/**
 * 获取上一天的日期
 */
function getPreviousDay(dateStr: string): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() - 1)
  return formatDate(date)
}

/**
 * 获取周号 (1-53)
 */
function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDay.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7)
}

/**
 * 创建 Session 索引条目
 */
function createSessionIndexEntry(record: PomodoroRecord): SessionIndexEntry {
  const dateStr = formatDate(record.start_at)
  return {
    id: record.id,
    dateTimestamp: getDateTimestamp(dateStr),
    kind: record.kind as "focus" | "rest",
    status: record.status as "completed" | "stopped" | "skipped",
    elapsedSeconds: record.elapsed_seconds,
    dateStr,
  }
}

/**
 * 计算生产力指数 (0-100)
 * 基于完成的专注时长和目标时长的比例
 */
function calculateProductivity(totalSeconds: number, targetSeconds: number = 3600): number {
  // 假设目标是 1 小时
  const percentage = (totalSeconds / targetSeconds) * 100
  return Math.min(100, Math.round(percentage))
}

/**
 * 按日期分组 Records
 */
function groupRecordsByDate(records: PomodoroRecord[]): Record<string, PomodoroRecord[]> {
  const grouped: Record<string, PomodoroRecord[]> = {}

  for (const record of records) {
    const dateStr = formatDate(record.start_at)
    if (!grouped[dateStr]) {
      grouped[dateStr] = []
    }
    grouped[dateStr].push(record)
  }

  return grouped
}

/**
 * 按月份分组 Session Records
 */
function groupRecordsByMonth(records: PomodoroRecord[]): Record<string, PomodoroRecord[]> {
  const grouped: Record<string, PomodoroRecord[]> = {}

  for (const record of records) {
    const monthStr = formatYearMonth(record.start_at)
    if (!grouped[monthStr]) {
      grouped[monthStr] = []
    }
    grouped[monthStr].push(record)
  }

  return grouped
}

/**
 * 计算日级统计数据
 */
export function calculateDayStats(records: PomodoroRecord[], dateStr: string): DayStats {
  const dayRecords = records.filter((r) => isSameDay(r.start_at, dateStr))

  const focusRecords = dayRecords.filter((r) => r.kind === "focus")
  const completedSessions = focusRecords.filter((r) => r.status === "completed").length
  const totalSeconds = focusRecords.reduce((acc, r) => acc + r.elapsed_seconds, 0)
  const productivity = calculateProductivity(totalSeconds)

  return {
    date: dateStr,
    timestamp: getDateTimestamp(dateStr),
    totalSeconds,
    completedSessions,
    totalRecords: dayRecords.length,
    productivity,
    status: totalSeconds > 0 ? "active" : "idle",
  }
}

/**
 * 获取某月的所有日期
 */
function getAllDatesInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split("-").map(Number)
  const daysInMonth = new Date(year, month, 0).getDate() // 获取该月天数
  const dates: string[] = []
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${yearMonth}-${String(day).padStart(2, "0")}`
    dates.push(dateStr)
  }
  
  return dates
}

/**
 * 计算月级统计数据
 * 返回该月所有日期的统计数据（包括没有记录的日期）
 */
export function calculateMonthStats(records: PomodoroRecord[], yearMonth: string): MonthStats {
  const monthRecords = records.filter((r) => formatYearMonth(r.start_at) === yearMonth)

  // 获取该月所有日期
  const allDates = getAllDatesInMonth(yearMonth)
  
  // 按日期分组（只包含有记录的日期）
  const byDate = groupRecordsByDate(monthRecords)

  // 计算各日的统计（包括没有记录的日期）
  const days = allDates.map((date) => {
    if (byDate[date]) {
      return calculateDayStats(monthRecords, date)
    }
    // 没有记录的日期返回空白统计
    return {
      date,
      timestamp: getDateTimestamp(date),
      totalSeconds: 0,
      completedSessions: 0,
      totalRecords: 0,
      productivity: 0,
      status: "idle" as const,
    }
  })

  // 计算聚合数据
  const focusRecords = monthRecords.filter((r) => r.kind === "focus")
  const completedSessions = focusRecords.filter((r) => r.status === "completed")
  const totalSeconds = focusRecords.reduce((acc, r) => acc + r.elapsed_seconds, 0)
  const avgSessionDuration = completedSessions.length > 0 ? totalSeconds / completedSessions.length : 0
  const activeDays = days.filter((d) => d.status === "active").length
  const productivities = days.map((d) => d.productivity)
  const maxProductivity = productivities.length > 0 ? Math.max(...productivities) : 0

  // 找最活跃的日期
  let mostProductiveDay: string | null = null
  if (productivities.length > 0) {
    const maxIndex = productivities.indexOf(maxProductivity)
    mostProductiveDay = days[maxIndex]?.date ?? null
  }

  return {
    yearMonth,
    days,
    totalSeconds,
    totalSessions: completedSessions.length,
    avgSessionDuration: Math.round(avgSessionDuration),
    activeDays,
    mostProductiveDay,
    maxProductivity,
  }
}

/**
 * 计算连续打卡天数（从今天往前）
 */
export function calculateCurrentStreak(days: DayStats[], endDate = new Date()): number {
  let streak = 0
  let currentDate = formatDate(endDate)

  while (true) {
    const dayStats = days.find((d) => d.date === currentDate)
    if (!dayStats || dayStats.status === "idle") {
      break
    }
    streak++
    currentDate = getPreviousDay(currentDate)
  }

  return streak
}

/**
 * 计算最长连续打卡天数
 */
export function calculateLongestStreak(days: DayStats[]): number {
  const sortedDays = [...days].sort((a, b) => a.timestamp - b.timestamp)
  let maxStreak = 0
  let currentStreak = 0
  let lastDate: string | null = null

  for (const day of sortedDays) {
    if (day.status === "idle") {
      currentStreak = 0
      lastDate = null
      continue
    }

    if (lastDate === null || isAdjacent(lastDate, day.date)) {
      currentStreak++
    } else {
      currentStreak = 1
    }

    lastDate = day.date
    maxStreak = Math.max(maxStreak, currentStreak)
  }

  return maxStreak
}

/**
 * 计算总体统计数据
 */
export function calculateOverallStats(
  _sessions: PomodoroSession[],
  records: PomodoroRecord[]
): OverallStats {
  // 按月分组
  const byMonth = groupRecordsByMonth(records)
  const monthKeys = Object.keys(byMonth).sort()

  // 计算各月统计
  const monthStats = monthKeys.map((month) => calculateMonthStats(records, month))

  // 获取所有日期统计
  const allDays: DayStats[] = []
  monthStats.forEach((m) => allDays.push(...m.days))
  allDays.sort((a, b) => a.timestamp - b.timestamp)

  // 计算聚合数据
  const focusRecords = records.filter((r) => r.kind === "focus")
  const completedSessions = focusRecords.filter((r) => r.status === "completed")
  const totalSeconds = focusRecords.reduce((acc, r) => acc + r.elapsed_seconds, 0)
  const totalActiveDays = allDays.filter((d) => d.status === "active").length
  const avgDailySeconds = totalActiveDays > 0 ? Math.round(totalSeconds / totalActiveDays) : 0
  const avgSessionDuration = completedSessions.length > 0 ? Math.round(totalSeconds / completedSessions.length) : 0

  // 计算连续天数
  const currentStreak = calculateCurrentStreak(allDays)
  const longestStreak = calculateLongestStreak(allDays)

  // 找最活跃的月份
  let mostProductiveMonth: string | null = null
  if (monthStats.length > 0) {
    const productivities = monthStats.map((m) => m.maxProductivity)
    const maxIndex = productivities.indexOf(Math.max(...productivities))
    mostProductiveMonth = monthStats[maxIndex]?.yearMonth ?? null
  }

  // 计算总体生产力指数
  const overallProductivity = allDays.length > 0 ? Math.round(allDays.reduce((acc, d) => acc + d.productivity, 0) / allDays.length) : 0

  return {
    totalSeconds,
    totalSessions: completedSessions.length,
    currentStreak,
    longestStreak,
    avgDailySeconds,
    avgSessionDuration,
    mostProductiveMonth,
    startDate: allDays.length > 0 ? allDays[0].date : null,
    endDate: allDays.length > 0 ? allDays[allDays.length - 1].date : null,
    totalActiveDays,
    overallProductivity,
  }
}

/**
 * 建立 Session 索引
 */
export function buildSessionIndex(records: PomodoroRecord[]): SessionIndexEntry[] {
  return records.map(createSessionIndexEntry).sort((a, b) => a.dateTimestamp - b.dateTimestamp)
}

/**
 * 计算周级统计数据
 */
export function calculateWeekStats(records: PomodoroRecord[], startDate: string): WeekStats {
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  const weekRecords = records.filter((r) => {
    const recordDate = new Date(formatDate(r.start_at))
    return recordDate >= start && recordDate <= end
  })

  const byDate = groupRecordsByDate(weekRecords)
  const dates = Object.keys(byDate).sort()
  const days = dates.map((date) => calculateDayStats(weekRecords, date))

  // 填补缺失的日期
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    const dateStr = formatDate(date)
    if (!days.find((d) => d.date === dateStr)) {
      days.push(calculateDayStats([], dateStr))
    }
  }
  days.sort((a, b) => a.timestamp - b.timestamp)

  const focusRecords = weekRecords.filter((r) => r.kind === "focus")
  const totalSeconds = focusRecords.reduce((acc, r) => acc + r.elapsed_seconds, 0)
  const activeDays = days.filter((d) => d.status === "active").length
  const avgDailySeconds = activeDays > 0 ? Math.round(totalSeconds / 7) : 0
  const completedSessions = focusRecords.filter((r) => r.status === "completed").length

  const year = start.getFullYear()
  const weekNum = getWeekNumber(start)

  return {
    yearWeek: `${year}-W${String(weekNum).padStart(2, "0")}`,
    startDate,
    endDate: formatDate(end),
    days,
    totalSeconds,
    totalSessions: completedSessions,
    activeDays,
    avgDailySeconds,
  }
}

/**
 * 计算对比分析数据
 */
export function calculateComparison(records: PomodoroRecord[], referenceDate = new Date()): ComparisonData {
  const today = formatDate(referenceDate)
  const currentMonth = formatYearMonth(today)

  // 获取上个月
  const refDate = new Date(referenceDate)
  refDate.setMonth(refDate.getMonth() - 1)
  const lastMonth = formatYearMonth(refDate)

  const currentMonthStats = calculateMonthStats(records, currentMonth)
  const lastMonthStats = calculateMonthStats(records, lastMonth)

  const thisWeekStart = new Date(referenceDate)
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay())
  const thisWeekStats = calculateWeekStats(records, formatDate(thisWeekStart))

  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const lastWeekStats = calculateWeekStats(records, formatDate(lastWeekStart))

  const lastMonthTotal = lastMonthStats.totalSeconds || 1
  const growthRate = ((currentMonthStats.totalSeconds - lastMonthTotal) / lastMonthTotal) * 100

  return {
    thisMonth: currentMonthStats.days,
    lastMonth: lastMonthStats.days,
    weekComparison: {
      thisWeek: thisWeekStats,
      lastWeek: lastWeekStats,
    },
    growthRate: Math.round(growthRate * 100) / 100,
  }
}

/**
 * 通过查询条件过滤统计数据
 */
export function filterStats(allStats: DayStats[], options: StatsQueryOptions): DayStats[] {
  let filtered = [...allStats]

  if (options.startDate) {
    filtered = filtered.filter((d) => d.date >= options.startDate!)
  }

  if (options.endDate) {
    filtered = filtered.filter((d) => d.date <= options.endDate!)
  }

  if (options.yearMonth) {
    filtered = filtered.filter((d) => d.date.startsWith(options.yearMonth!))
  }

  if (options.year) {
    filtered = filtered.filter((d) => d.date.startsWith(String(options.year)))
  }

  return filtered
}
