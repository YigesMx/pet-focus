use serde::{Deserialize, Serialize};

/// 成就定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementDefinition {
    /// 成就代码（唯一标识）
    pub code: &'static str,
    /// 成就名称
    pub name: &'static str,
    /// 成就描述
    pub description: &'static str,
    /// 成就图标（emoji 或图标名称）
    pub icon: &'static str,
    /// 解锁奖励金币数
    pub reward_coins: i64,
    /// 成就类别
    pub category: AchievementCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AchievementCategory {
    /// 专注次数相关
    FocusCount,
    /// 专注时长相关
    FocusDuration,
    /// 连续打卡相关
    Streak,
    /// 金币相关
    Coins,
    /// 特殊成就
    Special,
}

impl AchievementCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            AchievementCategory::FocusCount => "focus_count",
            AchievementCategory::FocusDuration => "focus_duration",
            AchievementCategory::Streak => "streak",
            AchievementCategory::Coins => "coins",
            AchievementCategory::Special => "special",
        }
    }
}

/// 用户统计数据（前端用）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserStats {
    pub coins: i64,
    pub total_coins_earned: i64,
    pub total_coins_spent: i64,
    pub total_focus_seconds: i64,
    pub total_focus_count: i32,
    pub streak_days: i32,
    pub max_streak_days: i32,
}

/// 成就信息（包含解锁状态）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementInfo {
    pub code: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub reward_coins: i64,
    pub category: String,
    pub unlocked: bool,
    pub unlocked_at: Option<String>,
}

/// 金币变化事件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoinsChangedEvent {
    pub coins: i64,
    pub delta: i64,
    pub transaction_type: String,
    pub description: String,
}

/// 成就解锁事件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementUnlockedEvent {
    pub code: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub reward_coins: i64,
}

// ============ 成就定义 ============

/// 所有成就定义
pub static ACHIEVEMENTS: &[AchievementDefinition] = &[
    // 专注次数成就
    AchievementDefinition {
        code: "first_focus",
        name: "初次专注",
        description: "完成第一次专注",
        icon: "🎯",
        reward_coins: 10,
        category: AchievementCategory::FocusCount,
    },
    AchievementDefinition {
        code: "focus_10",
        name: "专注新手",
        description: "累计完成10次专注",
        icon: "🌱",
        reward_coins: 50,
        category: AchievementCategory::FocusCount,
    },
    AchievementDefinition {
        code: "focus_50",
        name: "专注达人",
        description: "累计完成50次专注",
        icon: "🌿",
        reward_coins: 100,
        category: AchievementCategory::FocusCount,
    },
    AchievementDefinition {
        code: "focus_100",
        name: "专注大师",
        description: "累计完成100次专注",
        icon: "🌳",
        reward_coins: 200,
        category: AchievementCategory::FocusCount,
    },
    AchievementDefinition {
        code: "focus_500",
        name: "专注传奇",
        description: "累计完成500次专注",
        icon: "🏆",
        reward_coins: 500,
        category: AchievementCategory::FocusCount,
    },
    // 专注时长成就
    AchievementDefinition {
        code: "duration_1h",
        name: "一小时",
        description: "累计专注1小时",
        icon: "⏰",
        reward_coins: 20,
        category: AchievementCategory::FocusDuration,
    },
    AchievementDefinition {
        code: "duration_10h",
        name: "十小时",
        description: "累计专注10小时",
        icon: "⏳",
        reward_coins: 100,
        category: AchievementCategory::FocusDuration,
    },
    AchievementDefinition {
        code: "duration_100h",
        name: "百小时",
        description: "累计专注100小时",
        icon: "🕰️",
        reward_coins: 500,
        category: AchievementCategory::FocusDuration,
    },
    // 连续打卡成就
    AchievementDefinition {
        code: "streak_3",
        name: "三天坚持",
        description: "连续3天专注",
        icon: "🔥",
        reward_coins: 30,
        category: AchievementCategory::Streak,
    },
    AchievementDefinition {
        code: "streak_7",
        name: "一周坚持",
        description: "连续7天专注",
        icon: "💪",
        reward_coins: 70,
        category: AchievementCategory::Streak,
    },
    AchievementDefinition {
        code: "streak_30",
        name: "月度坚持",
        description: "连续30天专注",
        icon: "⭐",
        reward_coins: 300,
        category: AchievementCategory::Streak,
    },
    // 金币成就
    AchievementDefinition {
        code: "coins_100",
        name: "小富翁",
        description: "累计获得100金币",
        icon: "💰",
        reward_coins: 10,
        category: AchievementCategory::Coins,
    },
    AchievementDefinition {
        code: "coins_1000",
        name: "大富翁",
        description: "累计获得1000金币",
        icon: "💎",
        reward_coins: 50,
        category: AchievementCategory::Coins,
    },
];

/// 根据代码获取成就定义
pub fn get_achievement_definition(code: &str) -> Option<&'static AchievementDefinition> {
    ACHIEVEMENTS.iter().find(|a| a.code == code)
}

/// 金币奖励规则
pub mod coin_rules {
    /// 每分钟专注获得的金币数
    pub const COINS_PER_FOCUS_MINUTE: i64 = 1;
    /// 完成一次专注的基础奖励
    pub const FOCUS_COMPLETE_BONUS: i64 = 5;
    /// 每日启动奖励金币数
    pub const DAILY_LOGIN_REWARD: i64 = 5;
}
