use sea_orm::{entity::prelude::*, RelationDef, RelationTrait};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "pomodoro_sessions")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    /// focus | rest
    pub kind: String,
    /// completed | stopped | skipped
    pub status: String,
    pub round: i32,
    pub start_at: DateTimeUtc,
    pub end_at: DateTimeUtc,
    /// seconds
    pub elapsed_seconds: i32,
    pub related_todo_id: Option<i32>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        unreachable!("pomodoro_sessions has no relations")
    }
}
