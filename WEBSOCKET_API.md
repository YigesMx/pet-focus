# WebSocket API 文档

Pet Focus 提供基于 WebSocket 的 API 服务器，支持实时双向通信和事件推送。

> **⚠️ 重要说明**:  
> 本文档描述的是 **WebSocket API**，用于外部客户端（如浏览器、Python 脚本等）通过 `ws://127.0.0.1:8787/ws` 连接到 Pet Focus。
> 
> **WebSocket API 事件** 与 **Tauri 内部事件** 是两个不同的系统:
> - **WebSocket API 事件**: 通过 `todo.changes` 和 `todo.due` 频道推送，数据结构为 `{action, todo_id}` 等
> - **Tauri 内部事件**: 通过 `emit("todo-data-updated")` 发送给前端，包含 `{action, todoId, source}` 字段
> 
> 本文档仅描述 WebSocket API，不涉及 Tauri 内部事件系统。

## 📋 目录

- [概述](#概述)
- [连接](#连接)
- [协议](#协议)
- [消息类型](#消息类型)
- [API 方法](#api-方法)
- [事件订阅](#事件订阅)
- [错误处理](#错误处理)
- [示例](#示例)
- [最佳实践](#最佳实践)
- [安全性建议](#安全性建议)
- [故障排查](#故障排查)

---

## 概述

### 服务器信息

- **默认地址**: `ws://127.0.0.1:8787/ws`
- **协议**: WebSocket (RFC 6455)
- **消息格式**: JSON
- **编码**: UTF-8

### 特性

- ✅ **请求-响应模式**: 客户端调用服务器方法
- ✅ **事件推送**: 服务器主动推送数据变更
- ✅ **频道订阅**: 客户端选择性监听事件
- ✅ **连接管理**: 自动重连、心跳保活
- ✅ **并发支持**: 多客户端同时连接

---

## 连接

### 建立连接

```javascript
const ws = new WebSocket('ws://127.0.0.1:8787/ws');

ws.onopen = () => {
  console.log('✅ Connected to Pet Focus API');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('📥 Received:', message);
};

ws.onerror = (error) => {
  console.error('❌ WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('🔌 Connection closed:', event.code, event.reason);
};
```

### 启动/停止服务器

**方法 1: 通过托盘菜单**
- 右键点击系统托盘图标
- 选择 "启动 WebServer" 或 "停止 WebServer"

**方法 2: 通过 Tauri 命令**
```typescript
import { invoke } from '@tauri-apps/api/core';

// 启动服务器
await invoke('start_web_server');

// 停止服务器
await invoke('stop_web_server');

// 查询状态
const status = await invoke('web_server_status');
// { running: true, address: "127.0.0.1:8787" }
```

---

## 协议

### 消息结构

所有消息都是 JSON 对象，包含 `type` 字段标识消息类型：

```typescript
type WsMessage = 
  | CallMessage      // 客户端请求
  | ReplyMessage     // 服务器响应
  | ListenMessage    // 订阅频道
  | EventMessage     // 事件推送
```

---

## 消息类型

### 1. Call - 客户端请求

客户端调用服务器方法。

**格式**:
```json
{
  "type": "call",
  "body": {
    "id": "unique-request-id",
    "method": "todo.list",
    "params": { ... }
  }
}
```

**字段说明**:
- `id` (string, 必需): 唯一请求 ID，用于匹配响应
- `method` (string, 必需): 调用的方法名（格式：`模块.操作`）
- `params` (object, 可选): 方法参数

**示例**:
```json
{
  "type": "call",
  "body": {
    "id": "req-001",
    "method": "todo.create",
    "params": {
      "title": "学习 WebSocket API",
      "description": "阅读文档并实践",
      "due_date": "2025-01-15T10:00:00Z"
    }
  }
}
```

---

### 2. Reply - 服务器响应

服务器对 Call 请求的响应。

**格式**:
```json
{
  "type": "reply",
  "body": {
    "id": "unique-request-id",
    "method": "todo.create",
    "status": "success",
    "data": { ... },
    "error": null
  }
}
```

**字段说明**:
- `id` (string): 对应的请求 ID
- `method` (string): 调用的方法名
- `status` (string): 状态码 - `"success"` 或 `"error"`
- `data` (any, 可选): 成功时的返回数据
- `error` (string, 可选): 失败时的错误消息

**成功响应示例**:
```json
{
  "type": "reply",
  "body": {
    "id": "req-001",
    "method": "todo.create",
    "status": "success",
    "data": {
      "id": 42,
      "title": "学习 WebSocket API",
      "completed": false,
      "created_at": "2025-01-10T12:00:00Z"
    }
  }
}
```

**错误响应示例**:
```json
{
  "type": "reply",
  "body": {
    "id": "req-002",
    "method": "todo.invalid",
    "status": "error",
    "error": "Unknown method: todo.invalid"
  }
}
```

---

### 3. Listen - 订阅频道

客户端订阅事件频道，接收服务器推送。

**格式**:
```json
{
  "type": "listen",
  "body": {
    "channel": "todo.changes"
  }
}
```

**字段说明**:
- `channel` (string, 必需): 频道名称

**可用频道**:
- `todo.changes` - 待办事项变更事件（创建/更新/删除）
- `todo.due` - 待办事项到期提醒事件

**示例**:
```json
{
  "type": "listen",
  "body": {
    "channel": "todo.changes"
  }
}
```

---

### 4. Event - 事件推送

服务器向订阅的客户端推送事件。

**格式**:
```json
{
  "type": "event",
  "body": {
    "channel": "todo.changes",
    "data": { ... }
  }
}
```

**字段说明**:
- `channel` (string): 事件所属频道
- `data` (any): 事件数据

**示例**:
```json
{
  "type": "event",
  "body": {
    "channel": "todo.changes",
    "data": {
      "action": "created",
      "todo_id": 42
    }
  }
}
```

---

## API 方法

### Todo 模块

#### `todo.list` - 列出所有待办

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "1",
    "method": "todo.list"
  }
}
```

**参数**: 无

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "1",
    "method": "todo.list",
    "status": "success",
    "data": [
      {
        "id": 1,
        "title": "待办事项 1",
        "description": null,
        "completed": false,
        "priority": 0,
        "location": null,
        "tags": [],
        "start_at": null,
        "due_date": "2025-01-15T10:00:00Z",
        "recurrence_rule": null,
        "reminder_offset_minutes": 15,
        "reminder_method": null,
        "timezone": null,
        "created_at": "2025-01-10T08:00:00Z",
        "updated_at": "2025-01-10T08:00:00Z",
        "caldav_href": null,
        "caldav_etag": null,
        "pending_delete": false
      }
      // ... 更多待办
    ]
  }
}
```

---

#### `todo.get` - 获取单个待办

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "2",
    "method": "todo.get",
    "params": {
      "id": 1
    }
  }
}
```

**参数**:
- `id` (number, 必需): 待办 ID

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "2",
    "method": "todo.get",
    "status": "success",
    "data": {
      "id": 1,
      "title": "待办事项 1",
      "description": null,
      "completed": false,
      "priority": 0,
      // ... 完整字段
    }
  }
}
```

---

#### `todo.create` - 创建待办

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "3",
    "method": "todo.create",
    "params": {
      "title": "学习 Rust"
    }
  }
}
```

**参数**:
- `title` (string, 可选): 标题（如果不提供，默认为 "新待办"）

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "3",
    "method": "todo.create",
    "status": "success",
    "data": {
      "id": 42,
      "title": "学习 Rust",
      "description": null,
      "completed": false,
      "priority": 0,
      "location": null,
      "tags": [],
      "start_at": null,
      "due_date": null,
      "recurrence_rule": null,
      "reminder_offset_minutes": null,
      "reminder_method": null,
      "timezone": null,
      "created_at": "2025-01-10T12:00:00Z",
      "updated_at": "2025-01-10T12:00:00Z",
      "caldav_href": null,
      "caldav_etag": null,
      "pending_delete": false
    }
  }
}
```

---

#### `todo.update` - 更新待办基本信息

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "4",
    "method": "todo.update",
    "params": {
      "id": 42,
      "title": "学习 Rust 进阶",
      "completed": true
    }
  }
}
```

**参数**:
- `id` (number, 必需): 待办 ID
- `title` (string, 可选): 新标题
- `completed` (boolean, 可选): 完成状态

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "4",
    "method": "todo.update",
    "status": "success",
    "data": {
      "id": 42,
      "title": "学习 Rust 进阶",
      "completed": true,
      "updated_at": "2025-01-10T15:30:00Z",
      // ... 其他字段
    }
  }
}
```

---

#### `todo.update_details` - 更新待办详细信息

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "5",
    "method": "todo.update_details",
    "params": {
      "id": 42,
      "description": "完成 The Rust Book 第 1-10 章",
      "priority": 3,
      "location": "图书馆",
      "tags": ["学习", "编程"],
      "due_date": "2025-01-20T18:00:00Z",
      "reminder_offset_minutes": 30,
      "timezone": "Asia/Shanghai"
    }
  }
}
```

**参数**:
- `id` (number, 必需): 待办 ID
- `description` (string, 可选): 描述
- `priority` (number, 可选): 优先级 (0-5)
- `location` (string, 可选): 地点
- `tags` (array\<string\> | string, 可选): 标签数组或逗号分隔字符串
- `start_at` (string, 可选): 开始时间 (ISO 8601)
- `due_date` (string | null, 可选): 截止时间 (ISO 8601)，null 表示清除
- `recurrence_rule` (string, 可选): 重复规则 (iCalendar RRULE)
- `reminder_offset_minutes` (number, 可选): 提前提醒分钟数
- `reminder_method` (string, 可选): 提醒方式
- `timezone` (string, 可选): 时区 (IANA 格式)

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "5",
    "method": "todo.update_details",
    "status": "success",
    "data": {
      "id": 42,
      "title": "学习 Rust 进阶",
      "description": "完成 The Rust Book 第 1-10 章",
      "completed": false,
      "priority": 3,
      "location": "图书馆",
      "tags": ["学习", "编程"],
      "due_date": "2025-01-20T18:00:00Z",
      "reminder_offset_minutes": 30,
      "timezone": "Asia/Shanghai",
      "updated_at": "2025-01-10T16:00:00Z",
      // ... 其他字段
    }
  }
}
```

---

#### `todo.delete` - 删除待办

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "6",
    "method": "todo.delete",
    "params": {
      "id": 42
    }
  }
}
```

**参数**:
- `id` (number, 必需): 待办 ID

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "6",
    "method": "todo.delete",
    "status": "success",
    "data": {
      "success": true
    }
  }
}
```

---

### Window 模块 (桌面平台)

#### `window.show` - 显示主窗口

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "7",
    "method": "window.show"
  }
}
```

**参数**: 无

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "7",
    "method": "window.show",
    "status": "success",
    "data": {
      "success": true
    }
  }
}
```

---

#### `window.hide` - 隐藏主窗口

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "8",
    "method": "window.hide"
  }
}
```

**参数**: 无

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "8",
    "method": "window.hide",
    "status": "success",
    "data": {
      "success": true
    }
  }
}
```

---

#### `window.toggle` - 切换主窗口显示/隐藏

**请求**:
```json
{
  "type": "call",
  "body": {
    "id": "9",
    "method": "window.toggle"
  }
}
```

**参数**: 无

**响应**:
```json
{
  "type": "reply",
  "body": {
    "id": "9",
    "method": "window.toggle",
    "status": "success",
    "data": {
      "success": true
    }
  }
}
```

---

## 事件订阅

### 订阅 Todo 变更事件

**1. 订阅频道**:
```json
{
  "type": "listen",
  "body": {
    "channel": "todo.changes"
  }
}
```

**2. 接收事件**:

**创建事件**:
```json
{
  "type": "event",
  "body": {
    "channel": "todo.changes",
    "data": {
      "action": "created",
      "todo_id": 42
    }
  }
}
```

**更新事件**:
```json
{
  "type": "event",
  "body": {
    "channel": "todo.changes",
    "data": {
      "action": "updated",
      "todo_id": 42
    }
  }
}
```

**删除事件**:
```json
{
  "type": "event",
  "body": {
    "channel": "todo.changes",
    "data": {
      "action": "deleted",
      "todo_id": 42
    }
  }
}
```

**事件字段说明**:
- `action` (string): 操作类型 - `"created"` | `"updated"` | `"deleted"`
- `todo_id` (number): 受影响的待办 ID

---

### 订阅 Todo 到期提醒事件

**1. 订阅频道**:
```json
{
  "type": "listen",
  "body": {
    "channel": "todo.due"
  }
}
```

**2. 接收事件**:
```json
{
  "type": "event",
  "body": {
    "channel": "todo.due",
    "data": {
      "todo_id": 42,
      "title": "学习 Rust"
    }
  }
}
```

**事件字段说明**:
- `todo_id` (number): 到期待办的 ID
- `title` (string): 待办标题

---

## 错误处理

### 错误响应格式

```json
{
  "type": "reply",
  "body": {
    "id": "request-id",
    "method": "method.name",
    "status": "error",
    "error": "Error message description"
  }
}
```

### 常见错误

| 错误消息 | 原因 | 解决方案 |
|---------|------|---------|
| `Unknown method: xxx` | 调用了不存在的方法 | 检查方法名拼写 |
| `Invalid params` | 参数格式错误 | 参考 API 文档检查参数 |
| `Database error: ...` | 数据库操作失败 | 检查数据完整性 |
| `Todo not found` | 待办事项不存在 | 确认 ID 是否正确 |
| `Parse error` | JSON 解析失败 | 检查消息格式 |

---

## 示例

### JavaScript/TypeScript 客户端

```typescript
class PetFocusClient {
  private ws: WebSocket;
  private pendingRequests = new Map<string, {
    resolve: (data: any) => void;
    reject: (error: string) => void;
  }>();
  private eventHandlers = new Map<string, Set<(data: any) => void>>();

  constructor(url: string = 'ws://127.0.0.1:8787/ws') {
    this.ws = new WebSocket(url);
    this.ws.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(event: MessageEvent) {
    const message = JSON.parse(event.data);

    switch (message.type) {
      case 'reply':
        this.handleReply(message.body);
        break;
      case 'event':
        this.handleEvent(message.body);
        break;
    }
  }

  private handleReply(body: any) {
    const pending = this.pendingRequests.get(body.id);
    if (!pending) return;

    if (body.status === 'success') {
      pending.resolve(body.data);
    } else {
      pending.reject(body.error);
    }

    this.pendingRequests.delete(body.id);
  }

  private handleEvent(body: any) {
    const handlers = this.eventHandlers.get(body.channel);
    if (handlers) {
      handlers.forEach(handler => handler(body.data));
    }
  }

  // 调用 API 方法
  async call(method: string, params?: any): Promise<any> {
    const id = `req-${Date.now()}-${Math.random()}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.ws.send(JSON.stringify({
        type: 'call',
        body: { id, method, params }
      }));
    });
  }

  // 订阅事件
  subscribe(channel: string, handler: (data: any) => void) {
    // 发送订阅消息
    this.ws.send(JSON.stringify({
      type: 'listen',
      body: { channel }
    }));

    // 注册处理器
    if (!this.eventHandlers.has(channel)) {
      this.eventHandlers.set(channel, new Set());
    }
    this.eventHandlers.get(channel)!.add(handler);
  }

  // 取消订阅
  unsubscribe(channel: string, handler: (data: any) => void) {
    const handlers = this.eventHandlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
    }
  }
}

// 使用示例
const client = new PetFocusClient();

// 等待连接
client.ws.addEventListener('open', async () => {
  console.log('✅ Connected');

  // 订阅事件
  client.subscribe('todo.changes', (data) => {
    console.log('📥 Todo changed:', data);
  });

  // 列出待办
  const todos = await client.call('todo.list');
  console.log('📋 Todos:', todos);

  // 创建待办
  const newTodo = await client.call('todo.create', {
    title: '测试待办',
    due_date: '2025-01-15T10:00:00Z'
  });
  console.log('✅ Created:', newTodo);

  // 更新待办
  await client.call('todo.update', {
    id: newTodo.id,
    completed: true
  });

  // 删除待办
  await client.call('todo.delete', {
    id: newTodo.id
  });
});
```

### Python 客户端

```python
import asyncio
import json
import uuid
import websockets

class PetFocusClient:
    def __init__(self, url="ws://127.0.0.1:8787/ws"):
        self.url = url
        self.ws = None
        self.pending_requests = {}
        self.event_handlers = {}

    async def connect(self):
        self.ws = await websockets.connect(self.url)
        asyncio.create_task(self._receive_loop())

    async def _receive_loop(self):
        async for message in self.ws:
            data = json.loads(message)
            
            if data["type"] == "reply":
                await self._handle_reply(data["body"])
            elif data["type"] == "event":
                await self._handle_event(data["body"])

    async def _handle_reply(self, body):
        request_id = body["id"]
        if request_id in self.pending_requests:
            future = self.pending_requests[request_id]
            
            if body["status"] == "success":
                future.set_result(body.get("data"))
            else:
                future.set_exception(Exception(body.get("error")))
            
            del self.pending_requests[request_id]

    async def _handle_event(self, body):
        channel = body["channel"]
        if channel in self.event_handlers:
            for handler in self.event_handlers[channel]:
                await handler(body["data"])

    async def call(self, method, params=None):
        request_id = str(uuid.uuid4())
        future = asyncio.Future()
        self.pending_requests[request_id] = future

        message = {
            "type": "call",
            "body": {
                "id": request_id,
                "method": method,
                "params": params
            }
        }

        await self.ws.send(json.dumps(message))
        return await future

    async def subscribe(self, channel, handler):
        message = {
            "type": "listen",
            "body": {"channel": channel}
        }
        await self.ws.send(json.dumps(message))

        if channel not in self.event_handlers:
            self.event_handlers[channel] = []
        self.event_handlers[channel].append(handler)

# 使用示例
async def main():
    client = PetFocusClient()
    await client.connect()

    # 订阅事件
    async def on_todo_change(data):
        print(f"📥 Todo changed: {data}")
    
    await client.subscribe("todo.changes", on_todo_change)

    # 列出待办
    todos = await client.call("todo.list")
    print(f"📋 Todos: {len(todos)} items")

    # 创建待办
    new_todo = await client.call("todo.create", {
        "title": "测试待办",
        "due_date": "2025-01-15T10:00:00Z"
    })
    print(f"✅ Created: {new_todo['id']}")

    # 保持连接
    await asyncio.sleep(3600)

asyncio.run(main())
```

---

## 最佳实践

### 1. 请求 ID 管理

使用 UUID 或时间戳组合生成唯一 ID：
```javascript
const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

### 2. 超时处理

为每个请求设置超时：
```javascript
async call(method, params, timeout = 5000) {
  return Promise.race([
    this.sendRequest(method, params),
    new Promise((_, reject) => 
      setTimeout(() => reject('Request timeout'), timeout)
    )
  ]);
}
```

### 3. 重连机制

WebSocket 断开时自动重连：
```javascript
function connectWithRetry(url, maxRetries = 5) {
  let retries = 0;
  
  function connect() {
    const ws = new WebSocket(url);
    
    ws.onclose = () => {
      if (retries < maxRetries) {
        retries++;
        setTimeout(() => connect(), 1000 * retries);
      }
    };
    
    return ws;
  }
  
  return connect();
}
```

### 4. 事件去重

防止重复订阅：
```javascript
subscribe(channel, handler) {
  if (!this.subscribedChannels.has(channel)) {
    this.ws.send(JSON.stringify({
      type: 'listen',
      body: { channel }
    }));
    this.subscribedChannels.add(channel);
  }
  
  this.eventHandlers.get(channel).add(handler);
}
```

---

## 安全性建议

1. **仅本地访问**: 默认绑定 `127.0.0.1`，避免暴露到公网
2. **HTTPS 代理**: 如需远程访问，使用 nginx/caddy 添加 TLS
3. **认证**: 考虑添加 token 认证机制
4. **速率限制**: 防止客户端滥用 API

---

## 故障排查

### 连接失败

**问题**: WebSocket 连接失败  
**检查**:
1. WebServer 是否已启动（托盘菜单或 `web_server_status` 命令）
2. 端口 8787 是否被占用
3. 防火墙是否阻止连接

### 请求无响应

**问题**: 发送 Call 消息后无 Reply  
**检查**:
1. 请求格式是否正确
2. 方法名是否拼写正确
3. 参数类型是否匹配
4. 查看服务器日志（终端输出）

### 事件未收到

**问题**: 订阅频道后未收到 Event  
**检查**:
1. 是否已发送 Listen 消息
2. 频道名是否正确
3. 事件处理器是否正确注册
4. 是否有其他客户端触发了变更

---

## 更新日志

### v1.0.0 (2025-01-10)
- ✅ 初始版本发布
- ✅ Todo CRUD API
- ✅ 事件订阅系统
- ✅ 连接管理

---

**文档版本**: 1.0  
**API 版本**: 1.0  
**最后更新**: 2025-01-10  
**维护者**: YigesMx

如有问题或建议，请提交 [Issue](https://github.com/YigesMx/pet-focus/issues)。
