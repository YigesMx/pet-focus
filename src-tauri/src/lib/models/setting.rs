use super::super::entities::setting;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<setting::Model> for Setting {
    fn from(model: setting::Model) -> Self {
        Self {
            key: model.key,
            value: model.value,
            created_at: model.created_at.to_rfc3339(),
            updated_at: model.updated_at.to_rfc3339(),
        }
    }
}
