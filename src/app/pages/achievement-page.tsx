import { ScrollArea } from "@/components/ui/scroll-area"
import { CoinDisplay, AchievementList, UserStatsCard } from "@/features/achievement"

export function AchievementPage() {
  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-semibold">成就</h1>
        <CoinDisplay />
      </header>

      {/* 内容区域 */}
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {/* 统计数据 */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">我的数据</h2>
            <UserStatsCard />
          </section>

          {/* 成就列表 */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">成就列表</h2>
            <AchievementList showProgress />
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
