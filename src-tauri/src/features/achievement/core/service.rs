use anyhow::Result;
use chrono::{NaiveDate, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set,
};

use super::models::{coin_rules, AchievementInfo, CoinsChangedEvent, UserStats, ACHIEVEMENTS};
use crate::features::achievement::data::entities::{achievements, coin_transactions, user_stats};

/// 获取或创建用户统计数据（单例模式，只有一条记录）
pub async fn get_or_create_user_stats(db: &DatabaseConnection) -> Result<user_stats::Model> {
    if let Some(stats) = user_stats::Entity::find_by_id(1).one(db).await? {
        return Ok(stats);
    }

    // 创建默认记录
    let now = Utc::now();
    let new_stats = user_stats::ActiveModel {
        id: Set(1),
        coins: Set(0),
        total_coins_earned: Set(0),
        total_coins_spent: Set(0),
        total_focus_seconds: Set(0),
        total_focus_count: Set(0),
        streak_days: Set(0),
        max_streak_days: Set(0),
        last_focus_date: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let stats = new_stats.insert(db).await?;
    Ok(stats)
}

/// 获取用户统计数据（前端用）
pub async fn get_user_stats(db: &DatabaseConnection) -> Result<UserStats> {
    let stats = get_or_create_user_stats(db).await?;
    Ok(UserStats {
        coins: stats.coins,
        total_coins_earned: stats.total_coins_earned,
        total_coins_spent: stats.total_coins_spent,
        total_focus_seconds: stats.total_focus_seconds,
        total_focus_count: stats.total_focus_count,
        streak_days: stats.streak_days,
        max_streak_days: stats.max_streak_days,
    })
}

/// 获取当前金币数量
pub async fn get_coins(db: &DatabaseConnection) -> Result<i64> {
    let stats = get_or_create_user_stats(db).await?;
    Ok(stats.coins)
}

/// 增加金币
pub async fn add_coins(
    db: &DatabaseConnection,
    amount: i64,
    transaction_type: &str,
    description: &str,
    related_record_id: Option<i32>,
    related_achievement_code: Option<&str>,
) -> Result<CoinsChangedEvent> {
    let now = Utc::now();

    // 更新用户统计
    let stats = get_or_create_user_stats(db).await?;
    let new_coins = stats.coins + amount;
    let new_total_earned = if amount > 0 {
        stats.total_coins_earned + amount
    } else {
        stats.total_coins_earned
    };
    let new_total_spent = if amount < 0 {
        stats.total_coins_spent + amount.abs()
    } else {
        stats.total_coins_spent
    };

    let mut active: user_stats::ActiveModel = stats.into();
    active.coins = Set(new_coins);
    active.total_coins_earned = Set(new_total_earned);
    active.total_coins_spent = Set(new_total_spent);
    active.updated_at = Set(now);
    active.update(db).await?;

    // 记录交易
    let transaction = coin_transactions::ActiveModel {
        amount: Set(amount),
        transaction_type: Set(transaction_type.to_string()),
        description: Set(description.to_string()),
        related_record_id: Set(related_record_id),
        related_achievement_code: Set(related_achievement_code.map(|s| s.to_string())),
        created_at: Set(now),
        ..Default::default()
    };
    transaction.insert(db).await?;

    Ok(CoinsChangedEvent {
        coins: new_coins,
        delta: amount,
        transaction_type: transaction_type.to_string(),
        description: description.to_string(),
    })
}

/// 专注完成时的金币奖励
pub async fn reward_focus_complete(
    db: &DatabaseConnection,
    focus_seconds: i64,
    record_id: Option<i32>,
) -> Result<CoinsChangedEvent> {
    let focus_minutes = focus_seconds / 60;
    let coins =
        (focus_minutes * coin_rules::COINS_PER_FOCUS_MINUTE) + coin_rules::FOCUS_COMPLETE_BONUS;

    add_coins(
        db,
        coins,
        "focus_complete",
        &format!("专注{}分钟奖励", focus_minutes),
        record_id,
        None,
    )
    .await
}

/// 更新专注统计（完成一次专注后调用）
pub async fn update_focus_stats(db: &DatabaseConnection, focus_seconds: i64) -> Result<()> {
    let now = Utc::now();
    let today = now.format("%Y-%m-%d").to_string();

    let stats = get_or_create_user_stats(db).await?;

    // 计算连续天数
    let (new_streak, new_max_streak) = calculate_streak(
        stats.last_focus_date.as_deref(),
        &today,
        stats.streak_days,
        stats.max_streak_days,
    );

    let mut active: user_stats::ActiveModel = stats.into();
    active.total_focus_seconds = Set(active.total_focus_seconds.unwrap() + focus_seconds);
    active.total_focus_count = Set(active.total_focus_count.unwrap() + 1);
    active.streak_days = Set(new_streak);
    active.max_streak_days = Set(new_max_streak);
    active.last_focus_date = Set(Some(today));
    active.updated_at = Set(now);
    active.update(db).await?;

    Ok(())
}

/// 计算连续天数
fn calculate_streak(
    last_focus_date: Option<&str>,
    today: &str,
    current_streak: i32,
    max_streak: i32,
) -> (i32, i32) {
    let Some(last_date_str) = last_focus_date else {
        // 第一次专注
        return (1, 1.max(max_streak));
    };

    let Ok(last_date) = NaiveDate::parse_from_str(last_date_str, "%Y-%m-%d") else {
        return (1, 1.max(max_streak));
    };
    let Ok(today_date) = NaiveDate::parse_from_str(today, "%Y-%m-%d") else {
        return (current_streak, max_streak);
    };

    let diff = (today_date - last_date).num_days();

    match diff {
        0 => {
            // 同一天，不增加连续天数
            (current_streak, max_streak)
        }
        1 => {
            // 连续的一天
            let new_streak = current_streak + 1;
            (new_streak, new_streak.max(max_streak))
        }
        _ => {
            // 中断了，重新开始
            (1, max_streak)
        }
    }
}

/// 检查并解锁成就
pub async fn check_and_unlock_achievements(
    db: &DatabaseConnection,
) -> Result<Vec<super::models::AchievementUnlockedEvent>> {
    let stats = get_or_create_user_stats(db).await?;
    let mut unlocked = Vec::new();

    // 检查每个成就
    for achievement in ACHIEVEMENTS {
        // 检查是否已解锁
        let exists = achievements::Entity::find()
            .filter(achievements::Column::Code.eq(achievement.code))
            .one(db)
            .await?;

        if exists.is_some() {
            continue;
        }

        // 检查是否满足条件
        let should_unlock = match achievement.code {
            "first_focus" => stats.total_focus_count >= 1,
            "focus_10" => stats.total_focus_count >= 10,
            "focus_50" => stats.total_focus_count >= 50,
            "focus_100" => stats.total_focus_count >= 100,
            "focus_500" => stats.total_focus_count >= 500,
            "duration_1h" => stats.total_focus_seconds >= 3600,
            "duration_10h" => stats.total_focus_seconds >= 36000,
            "duration_100h" => stats.total_focus_seconds >= 360000,
            "streak_3" => stats.streak_days >= 3,
            "streak_7" => stats.streak_days >= 7,
            "streak_30" => stats.streak_days >= 30,
            "coins_100" => stats.total_coins_earned >= 100,
            "coins_1000" => stats.total_coins_earned >= 1000,
            _ => false,
        };

        if should_unlock {
            // 解锁成就
            let now = Utc::now();
            let new_achievement = achievements::ActiveModel {
                code: Set(achievement.code.to_string()),
                unlocked_at: Set(now),
                created_at: Set(now),
                ..Default::default()
            };
            new_achievement.insert(db).await?;

            // 发放奖励
            add_coins(
                db,
                achievement.reward_coins,
                "achievement",
                &format!("成就「{}」解锁奖励", achievement.name),
                None,
                Some(achievement.code),
            )
            .await?;

            unlocked.push(super::models::AchievementUnlockedEvent {
                code: achievement.code.to_string(),
                name: achievement.name.to_string(),
                description: achievement.description.to_string(),
                icon: achievement.icon.to_string(),
                reward_coins: achievement.reward_coins,
            });
        }
    }

    Ok(unlocked)
}

/// 获取所有成就列表（包含解锁状态）
pub async fn list_achievements(db: &DatabaseConnection) -> Result<Vec<AchievementInfo>> {
    let unlocked_achievements: Vec<achievements::Model> =
        achievements::Entity::find().all(db).await?;

    let unlocked_map: std::collections::HashMap<String, achievements::Model> =
        unlocked_achievements
            .into_iter()
            .map(|a| (a.code.clone(), a))
            .collect();

    let mut result = Vec::new();
    for achievement in ACHIEVEMENTS {
        let unlocked_record = unlocked_map.get(achievement.code);
        result.push(AchievementInfo {
            code: achievement.code.to_string(),
            name: achievement.name.to_string(),
            description: achievement.description.to_string(),
            icon: achievement.icon.to_string(),
            reward_coins: achievement.reward_coins,
            category: achievement.category.as_str().to_string(),
            unlocked: unlocked_record.is_some(),
            unlocked_at: unlocked_record.map(|r| r.unlocked_at.to_rfc3339()),
        });
    }

    Ok(result)
}

/// 获取金币交易记录
pub async fn list_coin_transactions(
    db: &DatabaseConnection,
    limit: u64,
) -> Result<Vec<coin_transactions::Model>> {
    let transactions = coin_transactions::Entity::find()
        .order_by_desc(coin_transactions::Column::CreatedAt)
        .limit(limit)
        .all(db)
        .await?;
    Ok(transactions)
}
