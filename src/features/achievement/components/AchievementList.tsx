import { useAchievements, useAchievementProgress } from "../hooks"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface AchievementListProps {
  className?: string
  showProgress?: boolean
}

export function AchievementList({ className, showProgress = true }: AchievementListProps) {
  const { data: achievements, isLoading } = useAchievements()
  const { total, unlocked, percentage } = useAchievementProgress()

  if (isLoading) {
    return <div className="text-muted-foreground p-4 text-center">加载中...</div>
  }

  return (
    <div className={cn("space-y-4", className)}>
      {showProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">成就进度</span>
            <span className="font-medium">
              {unlocked} / {total}
            </span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>
      )}

      <div className="grid gap-3">
        {achievements?.map((achievement) => (
          <div
            key={achievement.code}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 transition-colors",
              achievement.unlocked
                ? "bg-primary/5 border-primary/20"
                : "border-muted bg-muted/30 opacity-60"
            )}
          >
            <span className="text-2xl">{achievement.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{achievement.name}</span>
                {achievement.unlocked && (
                  <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs">
                    已解锁
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{achievement.description}</p>
              <div className="mt-1 flex items-center gap-1 text-xs">
                <span>🪙</span>
                <span className="text-amber-600">+{achievement.rewardCoins}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
