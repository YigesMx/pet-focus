use std::{collections::HashMap, sync::Arc, time::Duration};

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Manager, Wry};
use tokio::sync::Mutex;

use crate::features::todo::data::entity;

use super::{
    client::{CalDavClient, CalDavItem, RemoteTodo},
    config::CalDavConfigService,
};

const SYNC_EVENT: &str = "caldav-sync-event";
const DEFAULT_REMINDER_MINUTES: i32 = 15;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncReason {
    Startup,
    Manual,
    Scheduled,
    DataChanged,
    ConfigUpdated,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum SyncOutcome {
    Success {
        synced_at: String,
        created: usize,
        updated: usize,
        pushed: usize,
        deleted: usize,
    },
    Skipped {
        reason: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct CalDavSyncEvent {
    pub reason: SyncReason,
    pub outcome: SyncOutcome,
}

#[derive(Debug, Clone)]
pub struct CalDavSyncManager {
    inner: Arc<CalDavSyncInner>,
}

#[derive(Debug)]
struct CalDavSyncInner {
    db: DatabaseConnection,
    app_handle: AppHandle<Wry>,
    guard: Mutex<()>,
    running: std::sync::atomic::AtomicBool,
    scheduler_restart: Arc<tokio::sync::Notify>,
}

impl CalDavSyncManager {
    pub fn new(db: DatabaseConnection, app_handle: AppHandle<Wry>) -> Self {
        let manager = Self {
            inner: Arc::new(CalDavSyncInner {
                db,
                app_handle,
                guard: Mutex::new(()),
                running: std::sync::atomic::AtomicBool::new(false),
                scheduler_restart: Arc::new(tokio::sync::Notify::new()),
            }),
        };

        manager.spawn_scheduler();
        manager.trigger(SyncReason::Startup);

        manager
    }

    pub fn is_running(&self) -> bool {
        self.inner
            .running
            .load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn trigger(&self, reason: SyncReason) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(err) = manager.sync_internal(reason).await {
                eprintln!("CalDAV sync failed ({reason:?}): {err}");
            }
        });
    }

    pub async fn sync_now(&self, reason: SyncReason) -> Result<CalDavSyncEvent> {
        self.sync_internal(reason).await
    }

    fn spawn_scheduler(&self) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                let interval = CalDavConfigService::get_sync_interval_minutes(manager.db())
                    .await
                    .unwrap_or(15);

                println!("📅 CalDAV scheduler: next sync in {} minutes", interval);

                tokio::select! {
                    _ = tokio::time::sleep(Duration::from_secs(interval * 60)) => {
                        println!("🔄 CalDAV: Starting scheduled sync...");
                        match manager.sync_internal(SyncReason::Scheduled).await {
                            Ok(_) => println!("✅ CalDAV: Scheduled sync completed"),
                            Err(err) => eprintln!("❌ CalDAV scheduled sync failed: {err}"),
                        }
                    }
                    _ = manager.inner.scheduler_restart.notified() => {
                        println!("🔄 CalDAV scheduler: Restarting due to configuration change");
                        continue;
                    }
                }
            }
        });
    }

    /// 重启调度器（用于同步间隔更改后立即生效）
    pub fn restart_scheduler(&self) {
        self.inner.scheduler_restart.notify_one();
    }

    fn db(&self) -> &DatabaseConnection {
        &self.inner.db
    }

    async fn sync_internal(&self, reason: SyncReason) -> Result<CalDavSyncEvent> {
        let _lock = self.inner.guard.lock().await;
        if self
            .inner
            .running
            .swap(true, std::sync::atomic::Ordering::SeqCst)
        {
            return Ok(CalDavSyncEvent {
                reason,
                outcome: SyncOutcome::Skipped {
                    reason: "sync_already_running".to_string(),
                },
            });
        }

        let result = self.perform_sync(reason).await;

        self.inner
            .running
            .store(false, std::sync::atomic::Ordering::SeqCst);

        match &result {
            Ok(event) => self.emit_event(event),
            Err(err) => {
                let event = CalDavSyncEvent {
                    reason,
                    outcome: SyncOutcome::Error {
                        message: err.to_string(),
                    },
                };
                self.emit_event(&event);
                return Ok(event);
            }
        }

        result
    }

    async fn perform_sync(&self, reason: SyncReason) -> Result<CalDavSyncEvent> {
        let config = match CalDavConfigService::get_config(self.db()).await? {
            Some(config) => config,
            None => {
                CalDavConfigService::set_last_error(self.db(), None).await?;
                return Ok(CalDavSyncEvent {
                    reason,
                    outcome: SyncOutcome::Skipped {
                        reason: "missing_configuration".to_string(),
                    },
                });
            }
        };

        let client = CalDavClient::new(&config)?;
        let summary = synchronize_database(self.db(), &client).await?;
        let synced_at = summary.synced_at.to_rfc3339();

        CalDavConfigService::set_last_sync(self.db(), Some(summary.synced_at)).await?;
        CalDavConfigService::set_last_error(self.db(), None).await?;

        let event = CalDavSyncEvent {
            reason,
            outcome: SyncOutcome::Success {
                synced_at,
                created: summary.created,
                updated: summary.updated,
                pushed: summary.pushed,
                deleted: summary.deleted,
            },
        };

        Ok(event)
    }

    fn emit_event(&self, event: &CalDavSyncEvent) {
        use tauri::Emitter;

        eprintln!("[CalDAV Sync] Emitting event: {:?}", event.outcome);

        // 发送 CalDAV sync 事件（直接使用 Tauri Event）
        if let Err(err) = self.inner.app_handle.emit(SYNC_EVENT, event) {
            eprintln!("failed to emit CalDAV sync event: {err}");
        }

        // Toast 通知 (用户界面) & 触发调度器重新规划
        if let Some(state) = self.inner.app_handle.try_state::<crate::core::AppState>() {
            match &event.outcome {
                SyncOutcome::Success {
                    created,
                    updated,
                    pushed,
                    deleted,
                    ..
                } => {
                    eprintln!(
                        "[CalDAV Sync] Success! created={}, updated={}, pushed={}, deleted={}",
                        created, updated, pushed, deleted
                    );

                    // 通知前端：待办数据已变更，以便前端立即刷新列表
                    eprintln!("[CalDAV Sync] Emitting todo-data-updated event with source=caldav");
                    if let Err(err) = self.inner.app_handle.emit(
                        "todo-data-updated",
                        json!({ "action": "sync", "todoId": serde_json::Value::Null, "source": "caldav" }),
                    ) {
                        eprintln!("❌ failed to emit todo-data-updated event: {err}");
                    } else {
                        eprintln!("✅ Successfully emitted todo-data-updated event");
                    }

                    crate::features::todo::api::notifications::notify_sync_success(
                        state.notification(),
                        *created,
                        *updated,
                        *pushed,
                        *deleted,
                    );

                    // CalDAV 同步可能修改了待办的提醒时间，需要重新规划
                    if let Some(scheduler) = state.todo_scheduler() {
                        let scheduler = scheduler.clone();
                        tauri::async_runtime::spawn(async move {
                            scheduler.reschedule().await;
                        });
                    }
                }
                SyncOutcome::Error { message } => {
                    crate::features::todo::api::notifications::notify_sync_error(
                        state.notification(),
                        message,
                    );
                }
                SyncOutcome::Skipped { .. } => {
                    // 跳过时不显示通知
                }
            }
        }
    }
}

struct SyncSummary {
    synced_at: DateTime<Utc>,
    created: usize,
    updated: usize,
    pushed: usize,
    deleted: usize,
}

async fn synchronize_database(
    db: &DatabaseConnection,
    client: &CalDavClient,
) -> Result<SyncSummary> {
    let now = Utc::now();

    let remote_todos = client.fetch_todos().await?;

    let mut local_models = entity::Entity::find().all(db).await?;
    let mut by_href: HashMap<String, entity::Model> = HashMap::new();
    let mut by_uid: HashMap<String, entity::Model> = HashMap::new();

    for model in local_models.drain(..) {
        if let Some(href) = model.remote_url.clone() {
            by_href.insert(href, model.clone());
        }
        by_uid.insert(model.uid.clone(), model);
    }

    let mut created = 0usize;
    let mut updated = 0usize;

    for remote in &remote_todos {
        if let Some(existing) = by_href.remove(&remote.href) {
            by_uid.remove(&existing.uid);
            update_local_from_remote(db, existing, remote, now, client).await?;
            updated += 1;
        } else if let Some(existing) = by_uid.remove(&remote.item.uid) {
            if let Some(href) = existing.remote_url.clone() {
                by_href.remove(&href);
            }
            update_local_from_remote(db, existing, remote, now, client).await?;
            updated += 1;
        } else {
            create_local_from_remote(db, remote, now, client).await?;
            created += 1;
        }
    }

    let mut pushed = 0usize;
    let mut deleted = 0usize;

    let dirty_locals = entity::Entity::find()
        .filter(entity::Column::Dirty.eq(true))
        .all(db)
        .await?;

    for model in dirty_locals {
        // 如果是待删除的项（deleted_at 不为空）
        if model.deleted_at.is_some() {
            delete_remote_todo(db, client, model).await?;
            deleted += 1;
        } else {
            push_local_to_remote(db, client, model, now).await?;
            pushed += 1;
        }
    }

    // 检测远端已删除但本地仍存在的 todo（不在 remote_todos 中但有 remote_url 的本地项）
    // 这些应该从本地删除
    let remote_hrefs: std::collections::HashSet<String> =
        remote_todos.iter().map(|r| r.href.clone()).collect();

    for (href, local_model) in by_href {
        // 如果本地有 remote_url 但远端已不存在，且未被标记删除
        if local_model.deleted_at.is_none() && !remote_hrefs.contains(&href) {
            // 远端已删除，删除本地记录
            entity::Entity::delete_by_id(local_model.id)
                .exec(db)
                .await
                .with_context(|| {
                    format!(
                        "failed to delete local todo {} (removed from remote)",
                        local_model.id
                    )
                })?;
            deleted += 1;
        }
    }

    Ok(SyncSummary {
        synced_at: now,
        created,
        updated,
        pushed,
        deleted,
    })
}

async fn update_local_from_remote(
    db: &DatabaseConnection,
    existing: entity::Model,
    remote: &RemoteTodo,
    now: DateTime<Utc>,
    client: &CalDavClient,
) -> Result<()> {
    // 如果本地已标记删除，跳过（等待同步删除到远端）
    if existing.deleted_at.is_some() {
        return Ok(());
    }

    // Last-Write-Wins 策略：比较时间戳决定是否覆盖本地
    if existing.dirty {
        let local_modified = existing.last_modified_at;
        let remote_modified = remote.item.last_modified.unwrap_or(now);

        if remote_modified > local_modified {
            // 远端更新更晚，覆盖本地（即使本地有未推送的修改）
            eprintln!(
                "⚠️  Conflict resolved: Remote version is newer (remote: {}, local: {}), overwriting local todo {}",
                remote_modified.to_rfc3339(),
                local_modified.to_rfc3339(),
                existing.id
            );
            // 继续执行更新逻辑
        } else {
            // 本地更新更晚，保留本地修改，稍后会推送到远端
            eprintln!(
                "✓ Conflict resolved: Local version is newer (local: {}, remote: {}), keeping local todo {}",
                local_modified.to_rfc3339(),
                remote_modified.to_rfc3339(),
                existing.id
            );
            return Ok(());
        }
    }

    let mut active: entity::ActiveModel = existing.clone().into();
    apply_remote_to_active(db, &mut active, &remote.item, remote, now, client).await;

    active
        .update(db)
        .await
        .with_context(|| format!("failed to update local todo {} from CalDAV", existing.id))?;

    Ok(())
}

async fn create_local_from_remote(
    db: &DatabaseConnection,
    remote: &RemoteTodo,
    now: DateTime<Utc>,
    client: &CalDavClient,
) -> Result<()> {
    use sea_orm::ActiveValue::NotSet;

    let mut active = entity::ActiveModel {
        id: NotSet,
        parent_id: Set(None), // 稍后会通过 RELATED-TO 设置
        ..Default::default()
    };

    apply_remote_to_active(db, &mut active, &remote.item, remote, now, client).await;
    active.created_at = Set(now);

    active.insert(db).await.with_context(|| {
        format!(
            "failed to insert local todo from CalDAV resource {}",
            remote.href
        )
    })?;

    Ok(())
}

/// 删除远端 CalDAV todo 资源，并从本地数据库彻底移除
async fn delete_remote_todo(
    db: &DatabaseConnection,
    client: &CalDavClient,
    model: entity::Model,
) -> Result<()> {
    // 如果有远端URL，则尝试删除远端资源
    if let Some(href) = &model.remote_url {
        eprintln!(
            "Attempting to delete remote todo {} at href: {}",
            model.id, href
        );

        // 第一次尝试：使用 ETag
        let delete_result = client.delete_todo(href, model.remote_etag.as_deref()).await;

        match delete_result {
            Ok(_) => {
                eprintln!("Successfully deleted remote todo {}", model.id);
            }
            Err(err) => {
                let err_msg = err.to_string();
                eprintln!("Failed to delete remote todo {}: {}", model.id, err_msg);

                // 检查错误类型
                let is_not_found = err_msg.contains("404") || err_msg.contains("Not Found");
                let is_precondition_failed =
                    err_msg.contains("412") || err_msg.contains("Precondition Failed");

                if is_not_found {
                    eprintln!("Remote todo {} not found (404), already deleted", model.id);
                } else if is_precondition_failed {
                    eprintln!(
                        "ETag mismatch (412) for todo {}, trying without ETag",
                        model.id
                    );
                    // 第二次尝试：不使用 ETag 强制删除
                    if let Err(retry_err) = client.delete_todo(href, None).await {
                        let retry_msg = retry_err.to_string();
                        // 再次检查是否是 404
                        if !retry_msg.contains("404") && !retry_msg.contains("Not Found") {
                            return Err(retry_err).with_context(|| {
                                format!(
                                    "failed to force delete remote todo {}: {}",
                                    model.id, retry_msg
                                )
                            });
                        }
                        eprintln!("Remote todo {} not found on retry (404)", model.id);
                    }
                } else {
                    // 其他错误（网络、认证等）需要向上传播
                    return Err(err).with_context(|| {
                        format!("failed to delete remote todo {}: {}", model.id, err_msg)
                    });
                }
            }
        }
    }

    // 从本地数据库彻底删除
    entity::Entity::delete_by_id(model.id)
        .exec(db)
        .await
        .with_context(|| format!("failed to delete todo {} from local database", model.id))?;

    eprintln!("Successfully deleted local todo {}", model.id);
    Ok(())
}

/// 将本地 todo 推送到远端 CalDAV 服务器（创建或更新）
async fn push_local_to_remote(
    db: &DatabaseConnection,
    client: &CalDavClient,
    model: entity::Model,
    now: DateTime<Utc>,
) -> Result<()> {
    let body = build_ical_from_model(db, &model).await;

    let upload = if let Some(href) = &model.remote_url {
        // 第一次尝试：使用 ETag 进行乐观锁更新
        let update_result = client
            .update_todo(href, &body, model.remote_etag.as_deref())
            .await;

        match update_result {
            Ok(upload) => upload,
            Err(err) => {
                let err_msg = err.to_string();
                let is_412 = err_msg.contains("412") || err_msg.contains("Precondition Failed");

                if is_412 {
                    // 遇到 412 冲突，应用 Last-Write-Wins 策略
                    eprintln!(
                        "⚠️  412 Conflict detected for todo {}, applying Last-Write-Wins strategy",
                        model.id
                    );

                    // 获取远端最新版本
                    let remote_todo = client
                        .get_todo(href)
                        .await
                        .context("failed to fetch remote todo after 412 conflict")?;

                    let local_modified = model.last_modified_at;
                    let remote_modified = remote_todo.item.last_modified.unwrap_or(now);

                    if local_modified > remote_modified {
                        // 本地更新更晚，强制覆盖远端（不使用 ETag）
                        eprintln!(
                            "✓ Local version is newer (local: {}, remote: {}), force pushing todo {}",
                            local_modified.to_rfc3339(),
                            remote_modified.to_rfc3339(),
                            model.id
                        );
                        client
                            .update_todo(href, &body, None) // 不使用 ETag 强制更新
                            .await
                            .context("failed to force push local todo after 412")?
                    } else {
                        // 远端更新更晚，放弃推送，采用远端版本
                        eprintln!(
                            "⚠️  Remote version is newer (remote: {}, local: {}), discarding local changes for todo {}",
                            remote_modified.to_rfc3339(),
                            local_modified.to_rfc3339(),
                            model.id
                        );

                        // 用远端版本覆盖本地
                        let mut active: entity::ActiveModel = model.clone().into();
                        apply_remote_to_active(
                            db,
                            &mut active,
                            &remote_todo.item,
                            &remote_todo,
                            now,
                            client,
                        )
                        .await;
                        active
                            .update(db)
                            .await
                            .context("failed to update local with remote after 412")?;

                        return Ok(());
                    }
                } else {
                    // 其他错误，直接返回
                    return Err(err)
                        .with_context(|| format!("failed to upload todo {} to CalDAV", model.id));
                }
            }
        }
    } else {
        client
            .create_todo(&model.uid, &body)
            .await
            .with_context(|| format!("failed to create todo {} on CalDAV", model.id))?
    };

    let mut active: entity::ActiveModel = model.into();
    active.dirty = Set(false);
    active.remote_url = Set(Some(upload.href.clone()));
    active.remote_calendar_url = Set(Some(client.calendar_url().to_string()));
    active.remote_etag = Set(upload.etag.clone());
    active.last_synced_at = Set(Some(now));
    active.last_modified_at = Set(now);
    active.updated_at = Set(now);

    active
        .update(db)
        .await
        .context("failed to persist local todo after CalDAV upload")?;

    Ok(())
}

async fn apply_remote_to_active(
    db: &DatabaseConnection,
    active: &mut entity::ActiveModel,
    item: &CalDavItem,
    remote: &RemoteTodo,
    now: DateTime<Utc>,
    client: &CalDavClient,
) {
    let status = item.status.clone().unwrap_or_else(|| {
        if item.is_completed() {
            "COMPLETED"
        } else {
            "NEEDS-ACTION"
        }
        .to_string()
    });

    let existing_start = match &active.start_at {
        Set(value) => value.to_owned(),
        _ => now,
    };

    let existing_reminder = match &active.reminder_offset_minutes {
        Set(value) => *value,
        _ => DEFAULT_REMINDER_MINUTES,
    };

    let existing_timezone = match &active.timezone {
        Set(value) => value.clone(),
        _ => None,
    };

    let existing_method = match &active.reminder_method {
        Set(Some(value)) => Some(value.clone()),
        _ => None,
    };

    let percent_complete = if item.is_completed() {
        item.percent_complete.or(Some(100))
    } else {
        item.percent_complete
    };

    let reminder_minutes = item.reminder_minutes.unwrap_or(existing_reminder).max(0);

    active.uid = Set(item.uid.clone());
    active.title = Set(item.summary.clone());
    active.description = Set(item.description.clone());
    active.status = Set(status);
    active.completed = Set(item.is_completed());
    active.percent_complete = Set(percent_complete);
    active.priority = Set(item.priority);
    active.location = Set(item.location.clone());
    active.tags = Set(serialize_tags(&item.categories));
    active.start_at = Set(item.start.unwrap_or(existing_start));
    active.last_modified_at = Set(item.last_modified.unwrap_or(now));
    active.due_date = Set(item.due);
    active.recurrence_rule = Set(item.recurrence_rule.clone());
    active.reminder_offset_minutes = Set(reminder_minutes);
    active.timezone = Set(item.timezone.clone().or(existing_timezone));
    let reminder_method = existing_method.unwrap_or_else(|| "display".to_string());
    active.reminder_method = Set(Some(reminder_method));
    active.reminder_last_triggered_at = Set(None);
    active.completed_at = Set(item.completed_at);
    active.notified = Set(false);
    active.dirty = Set(false);
    active.remote_url = Set(Some(remote.href.clone()));
    active.remote_etag = Set(remote.etag.clone());
    active.remote_calendar_url = Set(Some(client.calendar_url().to_string()));
    active.sync_token = Set(None);
    active.last_synced_at = Set(Some(now));
    active.deleted_at = Set(None);
    active.updated_at = Set(now);

    // 处理 RELATED-TO (子任务关系)
    if let Some(parent_uid) = &item.related_to {
        // 根据 parent UID 查找本地父任务的 ID
        let parent = entity::Entity::find()
            .filter(entity::Column::Uid.eq(parent_uid))
            .one(db)
            .await
            .ok()
            .flatten();

        if let Some(parent_todo) = parent {
            active.parent_id = Set(Some(parent_todo.id));
            println!(
                "  -> Set parent_id={} for subtask UID={}",
                parent_todo.id, item.uid
            );
        } else {
            println!(
                "  -> Warning: Parent task UID={} not found for subtask UID={}",
                parent_uid, item.uid
            );
            active.parent_id = Set(None);
        }
    } else {
        active.parent_id = Set(None);
    }

    if matches!(active.reminder_offset_minutes, Set(value) if value <= 0) {
        active.reminder_offset_minutes = Set(DEFAULT_REMINDER_MINUTES);
    }

    if let Set(Some(method)) = &active.reminder_method {
        if method.is_empty() {
            active.reminder_method = Set(Some("display".to_string()));
        }
    }
}

fn serialize_tags(tags: &[String]) -> Option<String> {
    if tags.is_empty() {
        None
    } else {
        serde_json::to_string(tags).ok()
    }
}

async fn build_ical_from_model(db: &DatabaseConnection, model: &entity::Model) -> String {
    let mut lines = Vec::<String>::new();
    let stamp = Utc::now();

    lines.push("BEGIN:VCALENDAR".to_string());
    lines.push("VERSION:2.0".to_string());
    lines.push("PRODID:-//pet-focus//EN".to_string());

    // 如果有时区，添加 VTIMEZONE 组件
    if let Some(ref tz) = model.timezone {
        add_vtimezone(&mut lines, tz);
    }

    lines.push("BEGIN:VTODO".to_string());
    lines.push(format!("UID:{}", escape_ical_value(&model.uid)));
    lines.push(format!("DTSTAMP:{}", format_datetime(&stamp)));
    lines.push(format!(
        "LAST-MODIFIED:{}",
        format_datetime(&model.last_modified_at)
    ));
    lines.push(format!("SUMMARY:{}", escape_ical_value(&model.title)));

    if let Some(description) = &model.description {
        lines.push(format!("DESCRIPTION:{}", escape_ical_value(description)));
    }

    lines.push(format!("STATUS:{}", escape_ical_value(&model.status)));

    if let Some(percent) = model.percent_complete {
        lines.push(format!("PERCENT-COMPLETE:{}", percent));
    }

    if let Some(priority) = model.priority {
        lines.push(format!("PRIORITY:{}", priority));
    }

    if let Some(location) = &model.location {
        lines.push(format!("LOCATION:{}", escape_ical_value(location)));
    }

    if let Some(tags) = &model.tags {
        if let Ok(list) = serde_json::from_str::<Vec<String>>(tags) {
            if !list.is_empty() {
                let joined = list
                    .iter()
                    .map(|tag| escape_ical_value(tag))
                    .collect::<Vec<_>>()
                    .join(",");
                lines.push(format!("CATEGORIES:{}", joined));
            }
        }
    }

    if let Some(due) = model.due_date {
        if let Some(ref tz) = model.timezone {
            lines.push(format!(
                "DUE;TZID={}:{}",
                tz,
                format_datetime_local(&due, tz)
            ));
        } else {
            lines.push(format!("DUE:{}", format_datetime(&due)));
        }
    }

    // DTSTART: 根据是否有时区决定格式
    if let Some(ref tz) = model.timezone {
        lines.push(format!(
            "DTSTART;TZID={}:{}",
            tz,
            format_datetime_local(&model.start_at, tz)
        ));
    } else {
        lines.push(format!("DTSTART:{}", format_datetime(&model.start_at)));
    }

    if let Some(rule) = &model.recurrence_rule {
        lines.push(format!("RRULE:{}", rule));
    }

    if let Some(completed) = model.completed_at {
        lines.push(format!("COMPLETED:{}", format_datetime(&completed)));
    }

    // 处理父任务关系 (RELATED-TO)
    if let Some(parent_id) = model.parent_id {
        if let Ok(Some(parent)) = entity::Entity::find_by_id(parent_id).one(db).await {
            lines.push(format!("RELATED-TO:{}", escape_ical_value(&parent.uid)));
            println!(
                "  -> Generated RELATED-TO:{} for subtask UID={}",
                parent.uid, model.uid
            );
        } else {
            eprintln!(
                "  -> Warning: Parent task id={} not found for subtask UID={}",
                parent_id, model.uid
            );
        }
    }

    if model.reminder_offset_minutes > 0 {
        lines.push("BEGIN:VALARM".to_string());
        lines.push(format!("TRIGGER:-PT{}M", model.reminder_offset_minutes));
        lines.push("ACTION:DISPLAY".to_string());
        lines.push("DESCRIPTION:Reminder".to_string());
        lines.push("END:VALARM".to_string());
    }

    lines.push("END:VTODO".to_string());
    lines.push("END:VCALENDAR".to_string());
    lines.push(String::new());

    lines.join("\r\n")
}

/// 格式化 UTC 时间为 iCalendar 格式（带 Z 后缀表示 UTC）
fn format_datetime(value: &DateTime<Utc>) -> String {
    value.format("%Y%m%dT%H%M%SZ").to_string()
}

/// 格式化本地时间为 iCalendar 格式（不带 Z 后缀，配合 TZID 使用）
/// 将 UTC 时间转换为指定时区的本地时间
fn format_datetime_local(value: &DateTime<Utc>, tzid: &str) -> String {
    if let Ok(tz) = tzid.parse::<Tz>() {
        // 转换为指定时区的本地时间
        let local_time = value.with_timezone(&tz);
        return local_time.format("%Y%m%dT%H%M%S").to_string();
    }
    // 如果时区解析失败，直接使用 UTC 时间（不带 Z）
    value.format("%Y%m%dT%H%M%S").to_string()
}

/// 添加 VTIMEZONE 组件（简化版，仅支持常见时区）
fn add_vtimezone(lines: &mut Vec<String>, tzid: &str) {
    lines.push("BEGIN:VTIMEZONE".to_string());
    lines.push(format!("TZID:{}", tzid));

    // 简化处理：只添加基本的时区信息
    // 对于 Asia/Shanghai (UTC+8)
    if tzid.contains("Shanghai") || tzid.contains("China") {
        lines.push("BEGIN:STANDARD".to_string());
        lines.push("DTSTART:19700101T000000".to_string());
        lines.push("TZOFFSETFROM:+0800".to_string());
        lines.push("TZOFFSETTO:+0800".to_string());
        lines.push("END:STANDARD".to_string());
    } else {
        // 其他时区，使用通用格式（可能需要扩展）
        lines.push("BEGIN:STANDARD".to_string());
        lines.push("DTSTART:19700101T000000".to_string());
        lines.push("TZOFFSETFROM:+0000".to_string());
        lines.push("TZOFFSETTO:+0000".to_string());
        lines.push("END:STANDARD".to_string());
    }

    lines.push("END:VTIMEZONE".to_string());
}

fn escape_ical_value(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace(',', "\\,")
        .replace(';', "\\;")
}
