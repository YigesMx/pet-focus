use super::super::entities::todo;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: i32,
    pub title: String,
    pub completed: bool,
    pub created_date: String,
    pub modified_date: String,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<todo::Model> for Todo {
    fn from(model: todo::Model) -> Self {
        Self {
            id: model.id,
            title: model.title,
            completed: model.completed,
            created_date: model.created_date.to_rfc3339(),
            modified_date: model.modified_date.to_rfc3339(),
            due_date: model.due_date.map(|d| d.to_rfc3339()),
            created_at: model.created_at.to_rfc3339(),
            updated_at: model.updated_at.to_rfc3339(),
        }
    }
}
