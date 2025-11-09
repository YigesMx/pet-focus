# Pet Focus - 软件架构文档

## 📋 目录

- [概述](#概述)
- [整体架构](#整体架构)
- [后端架构 (Rust/Tauri)](#后端架构-rusttauri)
  - [核心模块 (core)](#核心模块-core)
  - [功能模块 (features)](#功能模块-features)
  - [基础设施 (infrastructure)](#基础设施-infrastructure)
- [前端架构 (React/TypeScript)](#前端架构-reacttypescript)
- [数据流](#数据流)
- [关键设计决策](#关键设计决策)

---

## 概述

Pet Focus 是一个基于 Tauri 2.x 的桌面应用程序，采用模块化的架构设计，支持待办事项管理、CalDAV 同步、WebSocket API 服务器等功能。

### 技术栈

**前端**:
- React 18
- TypeScript
- TanStack Query (React Query)
- Tailwind CSS + shadcn/ui
- Vite

**后端**:
- Rust (Edition 2021)
- Tauri 2.x
- SeaORM (SQLite)
- Axum (WebSocket Server)
- Tokio (异步运行时)

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/TS)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Todo Feature │  │CalDAV Feature│  │Settings Feat.│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         └─────────────────┴──────────────────┘               │
│                           │                                  │
│                  Tauri IPC (Commands)                        │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                   Backend (Rust/Tauri)                       │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │              Core (AppState, Feature Trait)            │  │
│  └────────────────────────┬──────────────────────────────┘  │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│  ┌──────▼──────┐   ┌──────▼──────┐   ┌─────▼─────┐        │
│  │   Features   │   │Infrastructure│   │  Registry  │        │
│  │              │   │              │   │            │        │
│  │ • Todo       │   │ • Database   │   │ • Commands │        │
│  │ • Settings   │   │ • WebServer  │   │ • Tray     │        │
│  │ • Window     │   │ • Tray       │   └────────────┘        │
│  │              │   │ • Notification│                        │
│  └──────┬───────┘   └──────┬───────┘                        │
│         │                  │                                 │
│         └──────────┬───────┘                                 │
│                    │                                         │
│            ┌───────▼────────┐                                │
│            │ SQLite Database │                                │
│            └────────────────┘                                │
└──────────────────────────────────────────────────────────────┘
```


---

## 后端架构 (Rust/Tauri)

后端采用**模块化的 Feature 架构**，遵循清晰的职责分离原则。

### 目录结构

```
src-tauri/src/
├── lib.rs                  # 应用入口，Tauri 启动配置
├── core/                   # 核心抽象和状态管理
│   ├── app.rs             # AppState 全局状态
│   ├── feature.rs         # Feature trait 定义
│   └── registry/          # 注册表（Commands, Tray）
│       ├── commands.rs    # 统一命令注册
│       └── tray.rs        # 托盘菜单布局
├── features/              # 业务功能模块
│   ├── todo/             # 待办事项功能
│   ├── settings/         # 设置管理
│   └── window/           # 窗口管理
└── infrastructure/        # 基础设施组件
    ├── database/         # 数据库初始化和迁移
    ├── webserver/        # WebSocket API 服务器
    ├── tray/             # 系统托盘管理
    └── notification/     # 统一通知系统
```

---

### 核心模块 (core)

#### 1. Feature Trait

所有功能模块都实现 `Feature` trait，提供统一的生命周期接口：

```rust
#[async_trait]
pub trait Feature: Send + Sync {
    fn name(&self) -> &'static str;
    
    // 注册数据库迁移
    fn register_database(&self, registry: &mut DatabaseRegistry);
    
    // 注册 WebSocket 处理器
    fn register_ws_handlers(&self, registry: &mut HandlerRegistry);
    
    // 初始化（在 AppState 创建后）
    async fn initialize(&self, state: &AppState) -> Result<()>;
    
    // 类型转换（用于特定功能访问）
    fn as_any(&self) -> &dyn Any;
}
```

#### 2. AppState - 全局状态

`AppState` 是应用的中央状态管理器，持有所有 Features 和基础设施组件：

```rust
pub struct AppState {
    app_handle: AppHandle<Wry>,
    db: DatabaseConnection,
    features: HashMap<&'static str, Arc<dyn Feature>>,
    
    // 基础设施组件
    notification_manager: NotificationManager,
    caldav_sync_manager: CalDavSyncManager,
    
    #[cfg(desktop)]
    webserver_manager: WebServerManager,
    
    #[cfg(desktop)]
    tray_manager: TrayManager,
}
```

**生命周期**:
```rust
1. AppState::new()              // 构造阶段
2. app.manage(state)            // Tauri 托管
3. AppState::post_initialize()  // 后初始化
   ├── 创建系统托盘 (桌面)
   └── 自动启动 WebServer (桌面)
```

#### 3. Registry - 注册表模式

**Commands Registry** (`core/registry/commands.rs`):
- 统一管理所有 Tauri 命令
- 使用 `generate_handler!` 宏封装

**Tray Registry** (`core/registry/tray.rs`):
- 手动布局托盘菜单
- 各模块提供菜单项，在此统一组装

---

### 功能模块 (features)

每个 Feature 遵循统一的内部结构：

```
features/todo/
├── feature.rs          # Feature trait 实现
├── mod.rs             # 模块导出
├── core/              # 核心业务逻辑
│   ├── models.rs      # 业务模型
│   ├── service.rs     # 业务服务
│   └── scheduler.rs   # 提醒调度器
├── data/              # 数据层
│   ├── entity.rs      # SeaORM 实体
│   └── migration.rs   # 数据库迁移
├── api/               # API 接口层
│   ├── commands.rs    # Tauri 命令
│   ├── notifications.rs # 通知封装
│   └── tray.rs        # 托盘菜单项
└── sync/              # 同步功能（CalDAV）
    ├── sync.rs        # 同步管理器
    ├── config.rs      # 配置服务
    ├── client.rs      # CalDAV 客户端
    └── caldav_commands.rs # 同步命令
```

#### 主要 Features

##### 1. Todo Feature
- **核心功能**: CRUD 操作、提醒调度、完成状态管理
- **调度器**: `DueNotificationScheduler` - 管理待办提醒
  - 自动规划下一个提醒
  - 事件驱动重新规划（创建/更新/同步后）
- **CalDAV 同步**: 
  - 双向同步（本地 ↔️ CalDAV）
  - Last-Write-Wins 冲突解决策略
  - 定时自动同步（可配置间隔）
  - 支持手动触发同步

##### 2. Settings Feature
- **功能**: 键值对存储、主题偏好设置
- **服务**: `SettingService` - 提供 get/set/delete/list 操作
- **支持**: 布尔值、字符串等多种类型

##### 3. Window Feature (桌面)
- **功能**: 窗口显示/隐藏、焦点管理
- **macOS 特性**: Dock 图标动态显示/隐藏
- **关闭行为**: 关闭窗口 → 隐藏到托盘（不退出）

---

### 基础设施 (infrastructure)

#### 1. Database

**结构**:
```rust
infrastructure/database/
├── mod.rs              # 初始化和配置
└── registry.rs         # Migration 注册表
```

**特点**:
- SeaORM + SQLite
- 每个 Feature 注册自己的 migrations
- 统一的迁移管理

#### 2. WebServer (桌面专用)

**架构**: 三层设计

```
infrastructure/webserver/
├── api/                    # API 层
│   ├── handlers.rs        # HandlerRegistry
│   ├── commands.rs        # 启动/停止命令
│   └── tray.rs           # 托盘菜单项
├── core/                   # 核心层
│   ├── manager.rs         # WebServerManager
│   ├── router.rs          # Axum Router
│   ├── config.rs          # 配置管理
│   └── ws/               # WebSocket 协议
│       ├── protocol.rs    # 消息类型定义
│       ├── handler.rs     # 连接处理
│       └── context.rs     # API 上下文
└── mod.rs
```

**WebSocket 协议**:
```rust
enum WsMessage {
    Call { body: CallBody },      // 客户端调用
    Reply { body: ReplyBody },    // 服务器回复
    Listen { body: ListenBody },  // 订阅频道
    Event { body: EventBody },    // 事件推送
}
```

**特性**:
- 基于 Axum + WebSocket
- 动态注册处理器（HandlerRegistry）
- 连接管理（ConnectionManager）
- 事件广播支持
- 自动启动（可配置）

#### 3. Tray (桌面专用)

**动态托盘系统**:
```rust
infrastructure/tray/
├── manager.rs          # TrayManager
├── registry.rs         # TrayRegistry (动态可见性)
└── items.rs           # 通用托盘项
```

**特点**:
- 动态菜单项可见性（`is_visible` 回调）
- 各模块提供自己的菜单项
- 手动布局（在 `core/registry/tray.rs`）
- 支持运行时更新

**示例菜单结构**:
```
[显示/隐藏窗口]
─────────────────
[启动 WebServer]  ← 动态可见（服务器停止时）
[停止 WebServer]  ← 动态可见（服务器运行时）
─────────────────
[退出应用]
```

#### 4. Notification

**统一通知系统**:
```rust
pub struct NotificationManager {
    app_handle: AppHandle<Wry>,
}

impl NotificationManager {
    // Toast 通知（前端显示）
    pub fn send_toast(&self, message: &str);
    
    // WebSocket 事件（如果 WebServer 运行）
    pub fn send_websocket_event(&self, channel: &str, data: Value);
    
    // 统一通知（Toast + WebSocket）
    pub fn notify(&self, message: &str, channel: &str, data: Value);
}
```

**设计原则**:
- Toast 总是发送
- WebSocket 事件仅在服务器运行时发送
- 静默失败（不影响主流程）

---

## 前端架构 (React/TypeScript)

### 目录结构

```
src/
├── app/                    # 应用层
│   ├── pages/             # 页面组件
│   └── providers/         # 全局 Providers
├── features/              # 功能模块
│   ├── todo/
│   │   ├── api/          # API 调用
│   │   ├── components/   # UI 组件
│   │   └── hooks/        # 自定义 Hooks
│   ├── caldav/
│   └── settings/
├── components/            # 共享 UI 组件
└── shared/               # 共享工具
    └── lib/
```

### 关键模式

#### 1. Feature 模块化

每个 Feature 包含:
- **api/**: Tauri 命令封装
- **hooks/**: 业务逻辑 Hooks（React Query）
- **components/**: UI 组件

#### 2. React Query 集成

```typescript
// features/todo/api/todo.keys.ts
export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: string) => [...todoKeys.lists(), { filters }] as const,
}

// features/todo/hooks/useTodoManager.ts
export function useTodoManager() {
  const queryClient = useQueryClient()
  
  const { data: todos } = useQuery({
    queryKey: todoKeys.lists(),
    queryFn: listTodos,
  })
  
  const createMutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todoKeys.all })
    },
  })
  
  return { todos, createTodo: createMutation.mutate, ... }
}
```

#### 3. 事件同步

**外部数据源同步** (`useTodoSyncEvents`):
```typescript
// 监听后端 todo-data-updated 事件
listen<TodoSyncEvent>("todo-data-updated", (event) => {
  if (event.payload?.source === "webserver" || 
      event.payload?.source === "caldav") {
    // 刷新 React Query 缓存
    queryClient.invalidateQueries({ queryKey: todoKeys.all })
  }
})
```

---

## 数据流

### 1. 用户操作流程

```
用户在前端创建 Todo
  ↓
Tauri Command: create_todo()
  ↓
TodoService::create()
  ↓
写入 SQLite
  ↓
发送 Tauri Event: todo-data-updated
  ↓
NotificationManager::notify()
  ├── Toast 通知前端
  └── WebSocket 广播（如果服务器运行）
  ↓
前端 React Query 自动刷新
```

### 2. CalDAV 同步流程

```
定时器触发 / 手动同步
  ↓
CalDavSyncManager::sync_internal()
  ↓
1. 获取远程 todos
2. 对比本地数据库
3. 解决冲突（Last-Write-Wins）
4. 更新数据库
  ↓
发送事件: todo-data-updated (source=caldav)
  ↓
NotificationManager::notify_sync_success()
  ├── Toast: "同步成功：创建 X, 更新 Y..."
  └── WebSocket: 广播变更
  ↓
Scheduler::reschedule()  // 重新规划提醒
  ↓
前端监听事件并刷新
```

### 3. WebSocket 通信流程

```
客户端连接 ws://127.0.0.1:8787/ws
  ↓
发送 Call 消息:
{
  "type": "call",
  "body": {
    "id": "uuid",
    "method": "todo.list",
    "params": null
  }
}
  ↓
HandlerRegistry 查找处理器
  ↓
执行 TodoHandler::list()
  ↓
返回 Reply 消息:
{
  "type": "reply",
  "body": {
    "id": "uuid",
    "method": "todo.list",
    "status": "success",
    "data": [...]
  }
}
  ↓
客户端接收数据
```

---

## 关键设计决策

### 1. Feature 模式

**原因**:
- 清晰的模块边界
- 易于扩展和维护
- 每个 Feature 自包含（数据、逻辑、API）

**实现**:
- Feature trait 提供统一接口
- 在 `lib.rs` 中注册所有 Features
- AppState 管理 Feature 实例

### 2. Registry 模式

**Commands Registry**:
- 避免 `lib.rs` 过度膨胀
- 集中管理所有命令
- 易于查看完整的 API 列表

**Tray Registry**:
- 动态菜单（运行时可见性）
- 模块化菜单项提供
- 手动布局保证可控性

### 3. 后初始化 (post_initialize)

**问题**: 托盘创建和 WebServer 启动需要访问已托管的 AppState

**解决**:
```rust
// lib.rs
app.manage(state);

if let Some(state) = app.try_state::<AppState>() {
    state.post_initialize(&handle).await?;
}
```

**好处**:
- 清晰的生命周期阶段
- 逻辑归属正确的模块
- 避免循环依赖

### 4. 通知系统统一

**问题**: 之前 Toast 和 WebSocket 通知分散在各处

**解决**: `NotificationManager` 统一管理
- 一个方法同时发送两种通知
- 静默失败（WebSocket 可选）
- 易于维护和测试

### 5. 平台条件编译

**桌面专用功能** (使用 `#[cfg(not(any(target_os = "android", target_os = "ios")))]`):
- WebServer
- TrayManager
- Window 管理

**跨平台功能**:
- Todo 核心逻辑
- Settings
- Database

---

## 扩展指南

### 添加新 Feature

1. **创建目录结构**:
```
features/my_feature/
├── feature.rs
├── core/
├── data/
└── api/
```

2. **实现 Feature trait**:
```rust
#[async_trait]
impl Feature for MyFeature {
    fn name(&self) -> &'static str {
        "my_feature"
    }
    
    // 实现所需方法...
}
```

3. **注册 Feature**:
```rust
// lib.rs
fn init_features() -> Vec<Arc<dyn Feature>> {
    vec![
        // ... 其他 Features
        MyFeature::new(),
    ]
}
```

4. **注册命令**:
```rust
// core/registry/commands.rs
crate::features::my_feature::api::commands::my_command,
```

### 添加 WebSocket Handler

```rust
// features/my_feature/api/handlers.rs
pub struct MyHandler;

#[async_trait]
impl ApiHandler for MyHandler {
    fn method(&self) -> &str {
        "my_feature.action"
    }
    
    async fn handle(&self, ctx: &ApiContext, params: Option<Value>) -> Result<Value> {
        // 处理逻辑
    }
}

// features/my_feature/feature.rs
fn register_ws_handlers(&self, registry: &mut HandlerRegistry) {
    registry.register(Arc::new(MyHandler));
}
```

---

## 性能考虑

1. **异步优先**: 所有 I/O 操作使用 async/await
2. **连接池**: SeaORM 内置连接池管理
3. **React Query 缓存**: 减少不必要的 Tauri 调用
4. **事件驱动**: 使用 Tauri Events 而非轮询
5. **静默失败**: 非关键路径失败不阻塞主流程

---

## 安全性

1. **本地优先**: 数据存储在本地 SQLite
2. **WebServer 绑定**: 默认仅监听 127.0.0.1
3. **CalDAV 凭据**: 存储在本地数据库（考虑加密）
4. **Tauri 沙箱**: 利用 Tauri 的安全特性

---

## 测试策略

### 后端
- **单元测试**: 各 Service 层逻辑
- **集成测试**: Feature 完整流程
- **WebSocket 测试**: 协议和处理器

### 前端
- **组件测试**: React Testing Library
- **Hooks 测试**: @testing-library/react-hooks
- **E2E 测试**: Tauri WebDriver

---

## 未来规划

- [ ] Pomodoro Feature（番茄钟）
- [ ] 多语言支持 (i18n)
- [ ] 数据导入/导出
- [ ] 更多 CalDAV 服务器适配
- [ ] 插件系统
- [ ] 移动端支持（Tauri Mobile）

---

**文档版本**: 1.0  
**最后更新**: 2025-01-10  
**维护者**: YigesMx
