use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};

use crate::features::settings::core::service::SettingService;

const CONFIG_KEY: &str = "caldav.config";
const LAST_SYNC_KEY: &str = "caldav.last_sync";
const LAST_ERROR_KEY: &str = "caldav.last_error";
const SYNC_INTERVAL_KEY: &str = "caldav.sync_interval_minutes";
const DEFAULT_SYNC_INTERVAL_MINUTES: u64 = 15;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CalDavConfig {
    pub url: String,
    pub username: String,
    pub password: String,
}

impl CalDavConfig {
    pub fn is_valid(&self) -> bool {
        !self.url.trim().is_empty() && !self.username.trim().is_empty()
    }
}

pub struct CalDavConfigService;

impl CalDavConfigService {
    pub async fn get_config(db: &DatabaseConnection) -> Result<Option<CalDavConfig>> {
        let data = SettingService::get(db, CONFIG_KEY).await?;
        if let Some(raw) = data {
            let config: CalDavConfig = serde_json::from_str(&raw)
                .with_context(|| "failed to deserialize CalDAV configuration")?;
            if config.is_valid() {
                return Ok(Some(config));
            }
        }
        Ok(None)
    }

    pub async fn set_config(db: &DatabaseConnection, config: &CalDavConfig) -> Result<()> {
        let payload = serde_json::to_string(config)
            .with_context(|| "failed to serialize CalDAV configuration")?;
        SettingService::set(db, CONFIG_KEY, &payload).await?;
        // 重置状态
        let _ = SettingService::delete(db, LAST_ERROR_KEY).await?;
        Ok(())
    }

    pub async fn clear_config(db: &DatabaseConnection) -> Result<()> {
        let _ = SettingService::delete(db, CONFIG_KEY).await?;
        let _ = SettingService::delete(db, LAST_SYNC_KEY).await?;
        let _ = SettingService::delete(db, LAST_ERROR_KEY).await?;
        Ok(())
    }

    pub async fn get_last_sync(db: &DatabaseConnection) -> Result<Option<DateTime<Utc>>> {
        let value = SettingService::get(db, LAST_SYNC_KEY).await?;
        if let Some(raw) = value {
            let parsed = DateTime::parse_from_rfc3339(&raw)
                .with_context(|| format!("failed to parse CalDAV last sync time: {raw}"))?;
            return Ok(Some(parsed.with_timezone(&Utc)));
        }
        Ok(None)
    }

    pub async fn set_last_sync(
        db: &DatabaseConnection,
        value: Option<DateTime<Utc>>,
    ) -> Result<()> {
        if let Some(timestamp) = value {
            SettingService::set(db, LAST_SYNC_KEY, &timestamp.to_rfc3339()).await?;
        } else {
            let _ = SettingService::delete(db, LAST_SYNC_KEY).await?;
        }
        Ok(())
    }

    pub async fn get_last_error(db: &DatabaseConnection) -> Result<Option<String>> {
        Ok(SettingService::get(db, LAST_ERROR_KEY).await?)
    }

    pub async fn set_last_error(db: &DatabaseConnection, value: Option<&str>) -> Result<()> {
        match value {
            Some(message) if !message.is_empty() => {
                SettingService::set(db, LAST_ERROR_KEY, message).await?;
            }
            _ => {
                let _ = SettingService::delete(db, LAST_ERROR_KEY).await?;
            }
        }
        Ok(())
    }

    pub async fn get_sync_interval_minutes(db: &DatabaseConnection) -> Result<u64> {
        let raw = SettingService::get(db, SYNC_INTERVAL_KEY).await?;
        if let Some(raw_value) = raw {
            if let Ok(parsed) = raw_value.parse::<u64>() {
                if parsed > 0 {
                    return Ok(parsed);
                }
            }
        }
        Ok(DEFAULT_SYNC_INTERVAL_MINUTES)
    }

    pub async fn set_sync_interval_minutes(db: &DatabaseConnection, minutes: u64) -> Result<()> {
        let minutes = minutes.max(1);
        SettingService::set(db, SYNC_INTERVAL_KEY, &minutes.to_string()).await?;
        Ok(())
    }
}
