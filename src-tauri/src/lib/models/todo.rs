use super::super::entities::todo;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: i32,
    pub uid: String,
    pub title: String,
    pub description: Option<String>,
    pub completed: bool,
    pub status: String,
    pub percent_complete: Option<i32>,
    pub priority: Option<i32>,
    pub location: Option<String>,
    pub tags: Vec<String>,
    pub start_at: String,
    pub last_modified_at: String,
    pub due_date: Option<String>,
    pub recurrence_rule: Option<String>,
    pub reminder_offset_minutes: i32,
    pub timezone: Option<String>,
    pub reminder_method: Option<String>,
    pub reminder_last_triggered_at: Option<String>,
    pub completed_at: Option<String>,
    pub notified: bool,
    pub dirty: bool,
    pub remote_url: Option<String>,
    pub remote_etag: Option<String>,
    pub remote_calendar_url: Option<String>,
    pub sync_token: Option<String>,
    pub last_synced_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<todo::Model> for Todo {
    fn from(model: todo::Model) -> Self {
        let tags = model
            .tags
            .as_ref()
            .and_then(|raw| serde_json::from_str::<Vec<String>>(raw).ok())
            .unwrap_or_default();

        Self {
            id: model.id,
            uid: model.uid,
            title: model.title,
            description: model.description,
            completed: model.completed,
            status: model.status,
            percent_complete: model.percent_complete,
            priority: model.priority,
            location: model.location,
            tags,
            start_at: model.start_at.to_rfc3339(),
            last_modified_at: model.last_modified_at.to_rfc3339(),
            due_date: model.due_date.map(|d| d.to_rfc3339()),
            recurrence_rule: model.recurrence_rule,
            reminder_offset_minutes: model.reminder_offset_minutes,
            timezone: model.timezone,
            reminder_method: model.reminder_method,
            reminder_last_triggered_at: model.reminder_last_triggered_at.map(|d| d.to_rfc3339()),
            completed_at: model.completed_at.map(|d| d.to_rfc3339()),
            notified: model.notified,
            dirty: model.dirty,
            remote_url: model.remote_url,
            remote_etag: model.remote_etag,
            remote_calendar_url: model.remote_calendar_url,
            sync_token: model.sync_token,
            last_synced_at: model.last_synced_at.map(|d| d.to_rfc3339()),
            created_at: model.created_at.to_rfc3339(),
            updated_at: model.updated_at.to_rfc3339(),
        }
    }
}
