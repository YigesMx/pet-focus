import { useMemo } from "react";
import { getActivityLevel } from "@/features/pomodoro/api/stats.api";
import type { DailyStat } from "@/features/pomodoro/api/stats.api";

interface ContributionWallProps {
  data: DailyStat[];
  isLoading?: boolean;
  className?: string;
}

/**
 * GitHub 风格的砖墙统计组件
 * 展示过去 52 周的每日活动情况
 */
export function ContributionWall({ data, isLoading = false, className = "" }: ContributionWallProps) {
  // 生成日期矩阵（52 周 × 7 天）
  const weeks = useMemo(() => {
    const today = new Date();
    const weeks: (DailyStat | null)[][] = [];
    let currentWeek: (DailyStat | null)[] = [];

    // 从 52 周前的同一天开始
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 365);

    // 找到该周的星期一
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    // 创建一个日期到 DailyStat 的映射
    const dataMap = new Map(data.map((d) => [d.date, d]));

    let currentDate = new Date(startDate);
    let currentDayOfWeek = 1; // 1 = 星期一

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const stat = dataMap.get(dateStr) || null;

      currentWeek.push(stat);

      if (currentDayOfWeek === 7) {
        weeks.push([...currentWeek]);
        currentWeek = [];
        currentDayOfWeek = 1;
      } else {
        currentDayOfWeek++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 添加最后一周（如果有残余数据）
    if (currentWeek.length > 0) {
      weeks.push([...currentWeek]);
    }

    return weeks;
  }, [data]);

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex gap-1">
          {Array.from({ length: 52 }).map((_, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-1">
              {Array.from({ length: 7 }).map((_, dayIdx) => (
                <div key={dayIdx} className="w-3 h-3 rounded-sm bg-muted animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const formatFocusHours = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getActivityColor = (level: number): string => {
    const colors = {
      0: "bg-muted", // 无活动
      1: "bg-green-200 dark:bg-green-900", // < 30 分钟
      2: "bg-green-400 dark:bg-green-700", // < 1 小时
      3: "bg-green-600 dark:bg-green-500", // < 2 小时
      4: "bg-green-800 dark:bg-green-400", // >= 2 小时
    };
    return colors[level as keyof typeof colors];
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="flex gap-1 pb-2">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-1">
            {week.map((stat, dayIdx) => {
              const level = stat ? getActivityLevel(stat.focusSeconds) : 0;
              const dateStr = stat?.date || "";
              const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][dayIdx];
              const tooltipText = stat
                ? `${stat.date} (周${dayOfWeek})\n${formatFocusHours(stat.focusSeconds)} • ${stat.sessionCount} 个会话`
                : dateStr
                  ? `${dateStr} (周${dayOfWeek})\n无数据`
                  : "";

              return (
                <button
                  key={`${weekIdx}-${dayIdx}`}
                  title={tooltipText}
                  className={`w-3 h-3 rounded-sm transition-all hover:ring-1 hover:ring-foreground/50 cursor-help ${getActivityColor(level)}`}
                  aria-label={tooltipText}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
        <span>较少</span>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`w-3 h-3 rounded-sm ${getActivityColor(level)}`}
            />
          ))}
        </div>
        <span>较多</span>
      </div>
    </div>
  );
}
