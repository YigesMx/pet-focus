import { useUserStats } from "../hooks"
import { cn } from "@/lib/utils"

interface UserStatsCardProps {
  className?: string
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? ` ${minutes}分钟` : ""}`
  }
  return `${minutes}分钟`
}

export function UserStatsCard({ className }: UserStatsCardProps) {
  const { data: stats, isLoading } = useUserStats()

  if (isLoading || !stats) {
    return <div className="text-muted-foreground p-4 text-center">加载中...</div>
  }

  const statItems = [
    {
      label: "金币",
      value: stats.coins.toLocaleString(),
      icon: "🪙",
    },
    {
      label: "累计专注",
      value: formatDuration(stats.totalFocusSeconds),
      icon: "⏱️",
    },
    {
      label: "专注次数",
      value: stats.totalFocusCount.toLocaleString(),
      icon: "🎯",
    },
    {
      label: "连续天数",
      value: `${stats.streakDays}天`,
      icon: "🔥",
      subValue: stats.maxStreakDays > stats.streakDays ? `最高 ${stats.maxStreakDays}天` : undefined,
    },
  ]

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {statItems.map((item) => (
        <div key={item.label} className="bg-muted/30 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{item.icon}</span>
            <span className="text-muted-foreground text-sm">{item.label}</span>
          </div>
          <div className="mt-1 font-medium">{item.value}</div>
          {item.subValue && (
            <div className="text-muted-foreground text-xs">{item.subValue}</div>
          )}
        </div>
      ))}
    </div>
  )
}
