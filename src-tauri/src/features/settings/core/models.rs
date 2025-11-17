use crate::features::settings::data::entity;
use serde::{Deserialize, Serialize};

/// Setting 模型 (用于 API 响应)
///
/// 当前暂未使用，保留供将来的设置管理 API 使用
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<entity::Model> for Setting {
    fn from(model: entity::Model) -> Self {
        Self {
            key: model.key,
            value: model.value,
            created_at: model.created_at.to_rfc3339(),
            updated_at: model.updated_at.to_rfc3339(),
        }
    }
}
