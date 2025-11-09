use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use axum::extract::ws::Message;
use tokio::sync::{mpsc, RwLock};

use super::protocol::WsMessage;

pub type ConnectionId = String;
pub type ChannelName = String;

/// WebSocket 连接信息
#[derive(Debug)]
pub struct Connection {
    pub tx: mpsc::UnboundedSender<Message>,
    pub subscribed_channels: HashSet<ChannelName>,
}

/// WebSocket 连接管理器
#[derive(Debug, Clone)]
pub struct ConnectionManager {
    connections: Arc<RwLock<HashMap<ConnectionId, Connection>>>,
    channels: Arc<RwLock<HashMap<ChannelName, HashSet<ConnectionId>>>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            channels: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 注册新连接
    pub async fn register(&self, id: ConnectionId, tx: mpsc::UnboundedSender<Message>) {
        let mut conns = self.connections.write().await;
        conns.insert(
            id,
            Connection {
                tx,
                subscribed_channels: HashSet::new(),
            },
        );
    }

    /// 注销连接
    pub async fn unregister(&self, id: &ConnectionId) {
        let mut connections = self.connections.write().await;

        if let Some(conn) = connections.remove(id) {
            // 从所有订阅的频道中移除
            let mut channels = self.channels.write().await;
            for channel in &conn.subscribed_channels {
                if let Some(subscribers) = channels.get_mut(channel) {
                    subscribers.remove(id);
                    if subscribers.is_empty() {
                        channels.remove(channel);
                    }
                }
            }
            println!("Connection unregistered: {}", id);
        }
    }

    /// 订阅频道
    pub async fn subscribe(&self, conn_id: &ConnectionId, channel: ChannelName) {
        let mut connections = self.connections.write().await;
        let mut channels = self.channels.write().await;

        if let Some(conn) = connections.get_mut(conn_id) {
            conn.subscribed_channels.insert(channel.clone());

            channels
                .entry(channel.clone())
                .or_insert_with(HashSet::new)
                .insert(conn_id.clone());

            println!("Connection {} subscribed to channel: {}", conn_id, channel);
        }
    }

    /// 取消订阅频道
    pub async fn unsubscribe(&self, conn_id: &ConnectionId, channel: &ChannelName) {
        let mut connections = self.connections.write().await;
        let mut channels = self.channels.write().await;

        if let Some(conn) = connections.get_mut(conn_id) {
            conn.subscribed_channels.remove(channel);

            if let Some(subscribers) = channels.get_mut(channel) {
                subscribers.remove(conn_id);
                if subscribers.is_empty() {
                    channels.remove(channel);
                }
            }

            println!(
                "Connection {} unsubscribed from channel: {}",
                conn_id, channel
            );
        }
    }

    /// 向指定连接发送消息
    pub async fn send_to(&self, conn_id: &ConnectionId, message: WsMessage) -> Result<(), String> {
        let connections = self.connections.read().await;

        if let Some(conn) = connections.get(conn_id) {
            let json = serde_json::to_string(&message)
                .map_err(|e| format!("Failed to serialize message: {}", e))?;

            conn.tx
                .send(Message::Text(json.into()))
                .map_err(|e| format!("Failed to send message: {}", e))?;

            Ok(())
        } else {
            Err(format!("Connection not found: {}", conn_id))
        }
    }

    /// 向频道的所有订阅者广播消息
    pub async fn broadcast_to_channel(&self, channel: &ChannelName, message: WsMessage) {
        let channels = self.channels.read().await;

        if let Some(subscribers) = channels.get(channel) {
            let connections = self.connections.read().await;
            let json = serde_json::to_string(&message).unwrap_or_default();

            for conn_id in subscribers {
                if let Some(conn) = connections.get(conn_id) {
                    let _ = conn.tx.send(Message::Text(json.clone().into()));
                }
            }

            println!(
                "Broadcasted to channel {} ({} subscribers)",
                channel,
                subscribers.len()
            );
        }
    }

    /// 获取活跃连接数
    pub async fn connection_count(&self) -> usize {
        self.connections.read().await.len()
    }

    /// 获取频道订阅者数
    pub async fn channel_subscriber_count(&self, channel: &ChannelName) -> usize {
        self.channels
            .read()
            .await
            .get(channel)
            .map(|s| s.len())
            .unwrap_or(0)
    }
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}
