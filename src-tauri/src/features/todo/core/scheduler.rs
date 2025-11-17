use chrono::{DateTime, Utc};
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

use super::service;
use crate::features::todo::api::notifications;
use crate::infrastructure::notification::NotificationManager;

/// 到期提醒调度器
///
/// 工作流程：
/// 1. 找到最近需要提醒的 Todo（due_date - reminder_offset_minutes 最早的）
/// 2. 等待到提醒时间点
/// 3. 发送统一通知（Toast + WebSocket）
/// 4. 标记为已提醒（更新 reminder_last_triggered_at）
/// 5. 自动 reschedule 找下一个需要提醒的 Todo
pub struct DueNotificationScheduler {
    db: DatabaseConnection,
    notification_manager: Arc<NotificationManager>,
    next_reminder: Arc<RwLock<Option<(i32, DateTime<Utc>)>>>, // (todo_id, reminder_time)
    reschedule_tx: mpsc::Sender<()>,
}

impl Clone for DueNotificationScheduler {
    fn clone(&self) -> Self {
        Self {
            db: self.db.clone(),
            notification_manager: self.notification_manager.clone(),
            next_reminder: self.next_reminder.clone(),
            reschedule_tx: self.reschedule_tx.clone(),
        }
    }
}

impl DueNotificationScheduler {
    /// 创建新的调度器
    pub fn new(db: DatabaseConnection, notification_manager: Arc<NotificationManager>) -> Self {
        let (reschedule_tx, mut reschedule_rx) = mpsc::channel::<()>(32);
        let next_reminder = Arc::new(RwLock::new(None::<(i32, DateTime<Utc>)>));

        let scheduler = Self {
            db,
            notification_manager,
            next_reminder: next_reminder.clone(),
            reschedule_tx,
        };

        // 启动后台任务
        let scheduler_clone = scheduler.clone();
        tauri::async_runtime::spawn(async move {
            println!("[Scheduler] 后台任务已启动");

            // 初始化时计算一次
            scheduler_clone.schedule_next_reminder().await;

            loop {
                tokio::select! {
                    _ = reschedule_rx.recv() => {
                        // 收到重新调度信号，重新计算
                        println!("[Scheduler] 收到重新调度信号");
                        scheduler_clone.schedule_next_reminder().await;
                    }
                    _ = scheduler_clone.wait_until_next_reminder() => {
                        // 到了提醒时间，发送提醒
                        println!("[Scheduler] 到达提醒时间");
                        if let Err(e) = scheduler_clone.send_reminder_and_reschedule().await {
                            eprintln!("[Scheduler] 发送提醒时出错: {}", e);
                        }
                    }
                }
            }
        });

        scheduler
    }

    /// 触发重新调度
    pub async fn reschedule(&self) {
        println!("[Scheduler] 触发重新调度");
        if let Err(e) = self.reschedule_tx.send(()).await {
            eprintln!("[Scheduler] 发送重新调度信号失败: {}", e);
        }
    }

    /// 等待到下次提醒时间
    async fn wait_until_next_reminder(&self) {
        loop {
            let next = self.next_reminder.read().await.clone();
            if let Some((todo_id, reminder_time)) = next {
                let now = Utc::now();
                if reminder_time > now {
                    let duration = (reminder_time - now)
                        .to_std()
                        .unwrap_or(std::time::Duration::from_secs(60));
                    println!("[Scheduler] 等待 {:?} 后提醒 Todo#{}", duration, todo_id);
                    tokio::time::sleep(duration).await;
                    return;
                }
                // 如果时间已过，立即返回
                return;
            }
            // 如果没有待提醒的 Todo，等待一段时间后重试
            println!("[Scheduler] 没有待提醒的 Todo，休眠 60 秒");
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    }

    /// 计算并调度下次提醒
    async fn schedule_next_reminder(&self) {
        println!("[Scheduler] 查找下一个需要提醒的 Todo...");
        match service::get_next_reminder_todo(&self.db).await {
            Ok(Some(todo)) => {
                // 计算提醒时间 = due_date - reminder_offset_minutes
                if let Some(due_date) = todo.due_date {
                    let offset_minutes = todo.reminder_offset_minutes;
                    let reminder_time = due_date - chrono::Duration::minutes(offset_minutes as i64);

                    *self.next_reminder.write().await = Some((todo.id, reminder_time));
                    println!(
                        "[Scheduler] 下次提醒: Todo#{} \"{}\" 在 {}",
                        todo.id,
                        todo.title,
                        reminder_time.format("%Y-%m-%d %H:%M:%S")
                    );
                } else {
                    eprintln!("[Scheduler] Todo#{} 缺少 due_date", todo.id);
                    *self.next_reminder.write().await = None;
                }
            }
            Ok(None) => {
                *self.next_reminder.write().await = None;
                println!("[Scheduler] 没有待提醒的 Todo");
            }
            Err(e) => {
                eprintln!("[Scheduler] 查找待提醒 Todo 时出错: {}", e);
                *self.next_reminder.write().await = None;
            }
        }
    }

    /// 发送提醒并自动重新调度
    async fn send_reminder_and_reschedule(&self) -> anyhow::Result<()> {
        let next = self.next_reminder.read().await.clone();

        if let Some((todo_id, _)) = next {
            println!("[Scheduler] 发送提醒给 Todo#{}", todo_id);

            // 获取 Todo 详情
            let todo = service::get_todo_by_id(&self.db, todo_id).await?;

            // 统一发送 Toast + WebSocket 通知
            notifications::notify_todo_due(&self.notification_manager, todo.id, &todo.title);
            println!("[Scheduler] 通知已发送 (Todo#{})", todo_id);

            // 标记为已提醒
            service::mark_todo_reminded(&self.db, todo_id).await?;
            println!("[Scheduler] Todo#{} 已标记为已提醒", todo_id);

            // 自动重新调度找下一个
            self.schedule_next_reminder().await;
        }

        Ok(())
    }
}
