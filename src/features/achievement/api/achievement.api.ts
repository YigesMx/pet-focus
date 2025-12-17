import { invoke } from "@tauri-apps/api/core"

// ==================== Types ====================

export interface UserStats {
  coins: number
  totalCoinsEarned: number
  totalCoinsSpent: number
  totalFocusSeconds: number
  totalFocusCount: number
  streakDays: number
  maxStreakDays: number
}

export interface AchievementInfo {
  code: string
  name: string
  description: string
  icon: string
  rewardCoins: number
  category: string
  unlocked: boolean
  unlockedAt: string | null
}

export interface CoinTransaction {
  id: number
  amount: number
  transactionType: string
  description: string
  relatedRecordId: number | null
  relatedAchievementCode: string | null
  createdAt: string
}

export interface CoinsChangedEvent {
  coins: number
  delta: number
  transactionType: string
  description: string
}

// ==================== API Functions ====================

/**
 * 获取用户统计数据
 */
export async function getUserStats(): Promise<UserStats> {
  return await invoke<UserStats>("achievement_get_stats")
}

/**
 * 获取当前金币数量
 */
export async function getCoins(): Promise<number> {
  return await invoke<number>("achievement_get_coins")
}

/**
 * 获取所有成就列表（包含解锁状态）
 */
export async function listAchievements(): Promise<AchievementInfo[]> {
  return await invoke<AchievementInfo[]>("achievement_list")
}

/**
 * 获取金币交易记录
 */
export async function listCoinTransactions(limit?: number): Promise<CoinTransaction[]> {
  return await invoke<CoinTransaction[]>("achievement_list_transactions", {
    params: limit ? { limit } : undefined,
  })
}

/**
 * 检查并领取每日启动奖励
 * 返回奖励事件，如果今天已领取则返回 null
 */
export async function claimDailyReward(): Promise<CoinsChangedEvent | null> {
  return await invoke<CoinsChangedEvent | null>("achievement_claim_daily_reward")
}
