use sea_orm::{entity::prelude::*, RelationDef, RelationTrait};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "todos")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub uid: String,
    pub title: String,
    pub description: Option<String>,
    #[sea_orm(default_value = false)]
    pub completed: bool,
    #[sea_orm(default_value = "NEEDS-ACTION")]
    pub status: String,
    pub percent_complete: Option<i32>,
    pub priority: Option<i32>,
    pub location: Option<String>,
    pub tags: Option<String>,
    #[sea_orm(column_name = "created_date")]
    pub start_at: DateTimeUtc,
    #[sea_orm(column_name = "modified_date")]
    pub last_modified_at: DateTimeUtc,
    pub due_date: Option<DateTimeUtc>,
    pub recurrence_rule: Option<String>,
    #[sea_orm(column_name = "remind_before_minutes", default_value = 15)]
    pub reminder_offset_minutes: i32,
    pub timezone: Option<String>,
    pub reminder_method: Option<String>,
    pub reminder_last_triggered_at: Option<DateTimeUtc>,
    pub completed_at: Option<DateTimeUtc>,
    #[sea_orm(default_value = false)]
    pub notified: bool,
    #[sea_orm(default_value = false)]
    pub dirty: bool,
    pub remote_url: Option<String>,
    pub remote_etag: Option<String>,
    pub remote_calendar_url: Option<String>,
    pub sync_token: Option<String>,
    pub last_synced_at: Option<DateTimeUtc>,
    pub deleted_at: Option<DateTimeUtc>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        unreachable!("todos has no relations")
    }
}
