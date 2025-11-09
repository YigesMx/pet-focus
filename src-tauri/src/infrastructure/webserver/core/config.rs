use std::net::SocketAddr;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct WebServerConfig {
    pub host: String,
    pub port: u16,
}

impl Default for WebServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8787,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebServerStatus {
    pub running: bool,
    pub address: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
}

impl WebServerStatus {
    pub(crate) fn running(addr: SocketAddr) -> Self {
        Self {
            running: true,
            address: Some(format!("http://{}", addr)),
            host: Some(addr.ip().to_string()),
            port: Some(addr.port()),
        }
    }

    pub(crate) fn stopped() -> Self {
        Self {
            running: false,
            address: None,
            host: None,
            port: None,
        }
    }
}
