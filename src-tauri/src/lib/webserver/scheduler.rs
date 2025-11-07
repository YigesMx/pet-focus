use chrono::{DateTime, Duration, Utc};
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use tauri::async_runtime::JoinHandle;
use tokio::{
    sync::{mpsc, RwLock},
    time::{sleep, Duration as TokioDuration},
};

use super::super::services::todo;
use super::{
    channels::DUE_NOTIFICATION_CHANNEL, connection::ConnectionManager, message::WsMessage,
};

/// 调度器消息类型
enum SchedulerMessage {
    Reschedule,
    Stop,
}

#[derive(Clone)]
pub struct DueNotificationScheduler {
    tx: mpsc::UnboundedSender<SchedulerMessage>,
    main_handle: Arc<RwLock<Option<JoinHandle<()>>>>,
}

impl DueNotificationScheduler {
    pub fn new(db: DatabaseConnection, conn_mgr: ConnectionManager) -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let tx_clone = tx.clone();

        // 启动调度器主循环
        let main_task = tauri::async_runtime::spawn(async move {
            let mut current_task: Option<JoinHandle<()>> = None;

            while let Some(msg) = rx.recv().await {
                match msg {
                    SchedulerMessage::Reschedule => {
                        // 取消现有任务
                        if let Some(task) = current_task.take() {
                            task.abort();
                        }

                        // 获取下一个需要提醒的待办
                        let next_todo = match todo::get_next_due_todo(&db).await {
                            Ok(Some(todo)) => todo,
                            Ok(None) => {
                                println!("No upcoming due todos, scheduler idle");
                                continue;
                            }
                            Err(e) => {
                                eprintln!("Failed to get next due todo: {}", e);
                                continue;
                            }
                        };

                        // 计算提醒时间
                        let Some(due_date) = next_todo.due_date else {
                            continue;
                        };

                        let remind_at =
                            due_date - Duration::minutes(next_todo.reminder_offset_minutes as i64);
                        let now = Utc::now();

                        // 如果提醒时间已经过了，立即发送通知并重新调度
                        if remind_at <= now {
                            Self::send_notification_static(
                                &db,
                                &conn_mgr,
                                next_todo.id,
                                &next_todo.title,
                                due_date,
                            )
                            .await;
                            // 通过发送消息触发重新调度（而不是递归调用）
                            let _ = tx_clone.send(SchedulerMessage::Reschedule);
                            continue;
                        }

                        // 计算等待时间
                        let wait_duration = (remind_at - now)
                            .to_std()
                            .unwrap_or(TokioDuration::from_secs(0));

                        println!(
                            "Scheduled notification for todo {} '{}' at {}",
                            next_todo.id,
                            next_todo.title,
                            remind_at.to_rfc3339()
                        );

                        // 创建新的定时任务
                        let db_clone = db.clone();
                        let conn_mgr_clone = conn_mgr.clone();
                        let todo_id = next_todo.id;
                        let todo_title = next_todo.title.clone();
                        let tx_clone2 = tx_clone.clone();

                        current_task = Some(tauri::async_runtime::spawn(async move {
                            sleep(wait_duration).await;

                            // 发送通知
                            Self::send_notification_static(
                                &db_clone,
                                &conn_mgr_clone,
                                todo_id,
                                &todo_title,
                                due_date,
                            )
                            .await;

                            // 通知主循环重新调度下一个
                            let _ = tx_clone2.send(SchedulerMessage::Reschedule);
                        }));
                    }
                    SchedulerMessage::Stop => {
                        if let Some(task) = current_task.take() {
                            task.abort();
                        }
                        println!("Due notification scheduler stopped");
                        break;
                    }
                }
            }
        });

        Self {
            tx,
            main_handle: Arc::new(RwLock::new(Some(main_task))),
        }
    }

    /// 启动或重启调度器
    pub async fn reschedule(&self) {
        let _ = self.tx.send(SchedulerMessage::Reschedule);
    }

    /// 停止调度器
    pub async fn stop(&self) {
        let _ = self.tx.send(SchedulerMessage::Stop);

        // 等待主任务结束
        let mut handle_guard = self.main_handle.write().await;
        if let Some(handle) = handle_guard.take() {
            let _ = handle.await;
        }
    }

    /// 发送到期通知（静态方法）
    async fn send_notification_static(
        db: &DatabaseConnection,
        conn_mgr: &ConnectionManager,
        todo_id: i32,
        title: &str,
        due_date: DateTime<Utc>,
    ) {
        println!("Sending due notification for todo {} '{}'", todo_id, title);

        let notification = WsMessage::event(
            DUE_NOTIFICATION_CHANNEL.to_string(),
            serde_json::json!({
                "todo_id": todo_id,
                "title": title,
                "due_date": due_date.to_rfc3339(),
                "timestamp": Utc::now().to_rfc3339(),
            }),
        );

        conn_mgr
            .broadcast_to_channel(&DUE_NOTIFICATION_CHANNEL.to_string(), notification)
            .await;

        // 标记为已通知
        if let Err(e) = todo::mark_todo_notified(db, todo_id).await {
            eprintln!("Failed to mark todo {} as notified: {}", todo_id, e);
        }
    }
}
