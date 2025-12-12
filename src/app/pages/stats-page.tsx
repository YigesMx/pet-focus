import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ContributionWall, StatsOverview } from "@/features/stats"
import { SessionHistoryList } from "@/features/pomodoro/components/session-history-list"

export function StatsPage() {
  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <StatsOverview />

      {/* 月度贡献墙 */}
      <ContributionWall />

      {/* Sessions 列表 */}
      <Card>
        <CardHeader>
          <CardTitle>专注会话</CardTitle>
          <CardDescription>所有已记录的专注会话</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionHistoryList />
        </CardContent>
      </Card>
    </div>
  )
}
