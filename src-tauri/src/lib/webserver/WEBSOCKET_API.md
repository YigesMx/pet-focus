# WebSocket API 文档

## 概述

本项目使用 WebSocket 实现前外部通信。WebSocket 连接建立后，使用 JSON 格式的消息进行双向通信。

## 连接

- **端点**: `ws://localhost:8787/ws`
- **协议**: WebSocket (RFC 6455)
- **数据格式**: JSON

## 消息类型

### 1. Call - 客户端请求 (Client → Server)

客户端调用服务端方法，等待返回结果。

```json
{
  "type": "call",
  "body": {
    "id": "123",
    "method": "create_todo",
    "params": {
      "title": "新待办事项"
    }
  }
}
```

**字段说明**:
- `type`: 固定为 `"call"`
- `body`: 请求体对象
  - `id`: 请求ID，用于匹配响应，由客户端生成（字符串）
  - `method`: 调用的方法名
  - `params`: 方法参数（可选，不需要参数时可以省略此字段）

### 2. Reply - 服务端响应 (Server → Client)

服务端对 Call 请求的响应。

**成功响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "123",
    "method": "create_todo",
    "status": "success",
    "data": {
      "id": 1,
      "title": "新待办事项",
      "completed": false,
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

**错误响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "123",
    "method": "create_todo",
    "status": "error",
    "error": "错误信息"
  }
}
```

**字段说明**:
- `type`: 固定为 `"reply"`
- `body`: 响应体对象
  - `id`: 对应的请求ID
  - `method`: 对应的方法名
  - `status`: `"success"` 或 `"error"`
  - `data`: 成功时返回的数据（可选）
  - `error`: 失败时的错误信息（可选）

### 3. Listen - 订阅频道 (Client → Server)

客户端订阅特定频道，接收该频道的事件推送。

```json
{
  "type": "listen",
  "body": {
    "channel": "placeholder"
  }
}
```

**字段说明**:
- `type`: 固定为 `"listen"`
- `body`: 订阅体对象
  - `channel`: 要订阅的频道名

### 4. Event - 事件推送 (Server → Client)

服务端向订阅了特定频道的客户端推送事件。

```json
{
  "type": "event",
  "body": {
    "channel": "placeholder",
    "data": {
      "timestamp": "2024-01-01T00:00:00Z"
    }
  }
}
```

**字段说明**:
- `type`: 固定为 `"event"`
- `body`: 事件体对象
  - `channel`: 事件所属频道
  - `data`: 事件数据

## 可用方法

### list_todos

列出所有待办事项。

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "1",
    "method": "list_todos"
  }
}
```

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "1",
    "method": "list_todos",
    "status": "success",
    "data": [
      {
        "id": 1,
        "title": "待办1",
        "completed": false,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

### get_todo

获取指定 ID 的待办事项。

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "2",
    "method": "get_todo",
    "params": {
      "id": 1
    }
  }
}
```

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "2",
    "method": "get_todo",
    "status": "success",
    "data": {
      "id": 1,
      "title": "待办1",
      "completed": false,
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### create_todo

创建新的待办事项。

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "2",
    "method": "create_todo",
    "params": {
      "title": "新待办"
    }
  }
}
```

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "2",
    "method": "create_todo",
    "status": "success",
    "data": {
      "id": 2,
      "title": "新待办",
      "completed": false,
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### update_todo

更新待办事项。

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "3",
    "method": "update_todo",
    "params": {
      "id": 1,
      "title": "更新的标题",
      "completed": true
    }
  }
}
```

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "3",
    "method": "update_todo",
    "status": "success",
    "data": {
      "id": 1,
      "title": "更新的标题",
      "completed": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### delete_todo

删除待办事项。

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "4",
    "method": "delete_todo",
    "params": {
      "id": 1
    }
  }
}
```

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "4",
    "method": "delete_todo",
    "status": "success",
    "data": {
      "success": true
    }
  }
}
```

### wake_window

唤醒并显示应用主窗口。此方法会将隐藏的窗口显示出来并置于前台。

**特性**:
- 显示应用主窗口
- 将窗口置于前台并获得焦点
- macOS: 同时在 Dock 中显示应用图标

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "5",
    "method": "wake_window"
  }
}
```

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "5",
    "method": "wake_window",
    "status": "success",
    "data": {
      "success": true
    }
  }
}
```

**错误响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "5",
    "method": "wake_window",
    "status": "error",
    "error": "Failed to wake window: Main window not found"
  }
}
```

## 频道

### placeholder

占位频道，服务器每 5 秒向订阅者发送一条占位消息，用作测试。

**订阅**:
```json
{
  "type": "listen",
  "body": {
    "channel": "placeholder"
  }
}
```

**事件**:
```json
{
  "type": "event",
  "body": {
    "channel": "placeholder",
    "data": {
      "timestamp": "2024-01-01T00:00:00Z"
    }
  }
}
```

### due_notification

到期提醒频道，当待办事项的到期时间到达时，服务器会向订阅者发送提醒通知。

**订阅**:
```json
{
  "type": "listen",
  "body": {
    "channel": "due_notification"
  }
}
```

**事件**:
```json
{
  "type": "event",
  "body": {
    "channel": "due_notification",
    "data": {
      "todo_id": 1,
      "title": "重要会议",
      "due_date": "2025-11-05T15:00:00Z",
      "timestamp": "2025-11-05T14:45:00Z"
    }
  }
}
```

**字段说明**:
- `todo_id`: 待办事项的 ID
- `title`: 待办事项的标题
- `due_date`: 到期时间（ISO 8601 格式）
- `timestamp`: 通知发送时间（ISO 8601 格式）

**工作原理**:
1. 每个待办事项可以设置 `due_date`（到期时间）和 `remind_before_minutes`（提前提醒分钟数，默认 15 分钟）
2. 调度器会自动计算提醒时间：`remind_at = due_date - remind_before_minutes`
3. 当到达提醒时间时，服务器会向所有订阅了 `due_notification` 频道的客户端推送通知
4. 每个待办事项只会发送一次通知（通过 `notified` 字段标记）
5. 如果用户修改了待办事项的 `due_date`，`notified` 字段会重置为 `false`，允许再次发送通知

## 错误处理

当请求出错时，服务器会返回 `status: "error"` 的 Reply 消息：

```json
{
  "type": "reply",
  "body": {
    "id": "5",
    "method": "update_todo",
    "status": "error",
    "error": "Todo not found"
  }
}
```

客户端应该检查 `body.status` 字段并相应地处理错误。

## 连接管理

- 连接建立后，服务器会自动注册连接并分配唯一 ID
- 连接关闭时，服务器会自动清理连接和相关订阅
- 客户端应该处理连接断开并实现重连逻辑
- 建议使用心跳机制检测连接状态

## 性能建议

1. **批量操作**: 对于多个独立的 Call，可以并行发送，不需要等待前一个完成
2. **订阅管理**: 只订阅需要的频道，及时取消不需要的订阅
3. **重连策略**: 实现指数退避的重连机制
4. **消息队列**: 在断线期间缓存待发送的消息，重连后重新发送
