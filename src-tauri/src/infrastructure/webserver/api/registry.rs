use std::{collections::HashMap, sync::Arc};

use anyhow::Result;
use serde_json::Value;

use crate::infrastructure::webserver::core::ws::ApiContext;

/// WebSocket Call Handler 类型
///
/// 接收：
/// - method: 方法名
/// - params: 参数 JSON
/// - ctx: API 上下文
///
/// 返回：Result<Value> - 成功或错误
pub type WsCallHandler = Arc<
    dyn Fn(String, Value, ApiContext) -> futures::future::BoxFuture<'static, Result<Value>>
        + Send
        + Sync,
>;

/// WebSocket Event 元数据
#[derive(Debug, Clone)]
pub struct EventMetadata {
    /// 事件名称
    pub event: String,
    /// 事件描述
    pub description: String,
}

/// WebSocket Handler 注册表
///
/// 用于收集所有 Features 注册的：
/// 1. Call-Reply 处理器（method -> handler）
/// 2. Event 订阅事件（支持客户端订阅/广播）
///
/// # 设计原则
///
/// - Infrastructure 提供注册机制
/// - Features 提供具体实现
/// - Call: 通过 method 名称路由到对应 handler
/// - Event: 客户端订阅后接收广播消息
#[derive(Clone)]
pub struct HandlerRegistry {
    /// Call-Reply handlers
    call_handlers: Arc<HashMap<String, WsCallHandler>>,
    /// 可订阅的事件列表
    events: Arc<HashMap<String, EventMetadata>>,
}

impl HandlerRegistry {
    pub fn new() -> Self {
        Self {
            call_handlers: Arc::new(HashMap::new()),
            events: Arc::new(HashMap::new()),
        }
    }

    /// 注册一个 WebSocket Call-Reply Handler
    ///
    /// # 示例
    /// ```ignore
    /// registry.register_call("todo.list", |method, params, ctx| {
    ///     Box::pin(async move {
    ///         // 处理逻辑
    ///         Ok(serde_json::json!({"todos": []}))
    ///     })
    /// });
    /// ```
    pub fn register_call<F>(&mut self, method: impl Into<String>, handler: F)
    where
        F: Fn(String, Value, ApiContext) -> futures::future::BoxFuture<'static, Result<Value>>
            + Send
            + Sync
            + 'static,
    {
        Arc::get_mut(&mut self.call_handlers)
            .expect("Cannot register handlers after cloning")
            .insert(method.into(), Arc::new(handler));
    }

    /// 注册一个可订阅的 Event
    ///
    /// # 示例
    /// ```ignore
    /// registry.register_event("todo.due", "Todo 到期提醒事件");
    /// ```
    pub fn register_event(&mut self, event: impl Into<String>, description: impl Into<String>) {
        let event_name = event.into();
        Arc::get_mut(&mut self.events)
            .expect("Cannot register events after cloning")
            .insert(
                event_name.clone(),
                EventMetadata {
                    event: event_name,
                    description: description.into(),
                },
            );
    }

    /// 兼容旧的 register 方法（映射到 register_call）
    #[deprecated(note = "Use register_call instead")]
    pub fn register<F>(&mut self, method: impl Into<String>, handler: F)
    where
        F: Fn(String, Value, ApiContext) -> futures::future::BoxFuture<'static, Result<Value>>
            + Send
            + Sync
            + 'static,
    {
        self.register_call(method, handler);
    }

    /// 根据 method 查找对应的 Call handler
    pub fn get_call_handler(&self, method: &str) -> Option<WsCallHandler> {
        self.call_handlers.get(method).cloned()
    }

    /// 兼容旧的 get 方法
    pub fn get(&self, method: &str) -> Option<WsCallHandler> {
        self.get_call_handler(method)
    }

    /// 检查事件是否已注册
    pub fn is_event_registered(&self, event: &str) -> bool {
        self.events.contains_key(event)
    }

    /// 获取所有已注册的 Call 方法名
    pub fn call_methods(&self) -> Vec<String> {
        self.call_handlers.keys().cloned().collect()
    }

    /// 获取所有已注册的事件
    pub fn registered_events(&self) -> Vec<EventMetadata> {
        self.events.values().cloned().collect()
    }

    /// 兼容旧的 methods 方法
    pub fn methods(&self) -> Vec<String> {
        self.call_methods()
    }
}

impl Default for HandlerRegistry {
    fn default() -> Self {
        Self::new()
    }
}
