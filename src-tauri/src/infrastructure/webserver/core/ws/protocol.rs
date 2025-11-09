use serde::{Deserialize, Serialize};
use serde_json::Value;

/// WebSocket 消息类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum WsMessage {
    /// 客户端调用请求
    Call { body: CallBody },
    /// 服务器回复响应
    Reply { body: ReplyBody },
    /// 客户端订阅频道
    Listen { body: ListenBody },
    /// 服务器事件推送
    Event { body: EventBody },
}

/// Call 请求体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallBody {
    pub id: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

/// Reply 响应体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplyBody {
    pub id: String,
    pub method: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Listen 请求体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListenBody {
    pub channel: String,
}

/// Event 事件体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBody {
    pub channel: String,
    pub data: Value,
}

impl WsMessage {
    /// 创建成功的 Reply
    pub fn reply_success(id: String, method: String, data: Value) -> Self {
        WsMessage::Reply {
            body: ReplyBody {
                id,
                method,
                status: "success".to_string(),
                data: Some(data),
                error: None,
            },
        }
    }

    /// 创建错误的 Reply
    pub fn reply_error(id: String, method: String, error_msg: String) -> Self {
        WsMessage::Reply {
            body: ReplyBody {
                id,
                method,
                status: "error".to_string(),
                data: None,
                error: Some(error_msg),
            },
        }
    }

    /// 创建事件推送
    pub fn event(channel: String, data: Value) -> Self {
        WsMessage::Event {
            body: EventBody { channel, data },
        }
    }
}
