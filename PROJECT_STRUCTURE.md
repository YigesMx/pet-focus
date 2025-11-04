# 项目结构重构说明

## 概述

已成功将 `src-tauri/src` 目录下除了 `main.rs` 和 `lib.rs` 外的所有模块组织到 `lib/` 子目录中，使项目结构更加清晰。

## 新的目录结构

```
src-tauri/src/
├── lib.rs              # 库入口文件，声明所有子模块
├── main.rs             # 可执行文件入口，调用 lib::run()
└── lib/                # 所有业务逻辑模块
    ├── commands.rs         # Tauri 命令处理
    ├── db.rs               # 数据库初始化
    ├── entities/           # 数据库实体
    │   └── todo.rs
    ├── entities.rs         # entities 模块入口
    ├── models/             # 业务模型
    │   └── todo.rs
    ├── models.rs           # models 模块入口
    ├── services/           # 业务逻辑服务
    │   └── todo_service.rs
    ├── services.rs         # services 模块入口
    ├── tray.rs             # 系统托盘（桌面平台）
    ├── webserver/          # Web 服务器
    │   ├── context.rs
    │   ├── manager.rs
    │   ├── router.rs
    │   └── types.rs
    └── webserver.rs        # webserver 模块入口
```

## 模块声明方式

### lib.rs

使用内联模块声明，将所有子模块组织在 `lib` 命名空间下：

```rust
// 库模块声明 - 所有业务逻辑模块都在 lib 子目录下
mod lib {
    pub mod commands;
    pub mod db;
    pub mod entities;
    pub mod models;
    pub mod services;
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    pub mod tray;
    pub mod webserver;
}

// 重新导出公共 API
pub use lib::entities;
```

### 为什么不使用 lib/mod.rs？

由于 `lib.rs` 本身就是库的根文件，不能再声明一个名为 `lib` 的模块并使用 `mod.rs`。我们使用内联模块声明的方式，直接在 `lib.rs` 中声明 `mod lib { ... }`，Rust 会自动在 `lib/` 目录下查找对应的模块文件。

## 模块间引用规则

### 1. 从 lib.rs 引用子模块

```rust
// 在 lib.rs 中
use lib::webserver::WebServerManager;
lib::db::init_db(&handle);
lib::commands::list_todos;
```

### 2. lib/ 下的同级模块相互引用

```rust
// 在 lib/commands.rs 中引用其他同级模块
use super::{
    models::todo::Todo,
    services::todo_service,
    webserver::WebServerStatus,
};
```

### 3. lib/ 下的子目录模块引用

```rust
// 在 lib/services/todo_service.rs 中引用
// 需要用两个 super，一个回到 services 模块，一个回到 lib 模块
use super::super::{
    entities::todo,
    models::todo::Todo,
};
```

### 4. 引用 lib.rs 中定义的类型

```rust
// 所有模块都可以通过 crate:: 引用 lib.rs 中的公共类型
use crate::AppState;
```

## 导入路径规则总结

| 位置 | 引用同级模块 | 引用 lib.rs 类型 | 示例 |
|------|------------|----------------|------|
| lib.rs | `lib::module` | `AppState` | `lib::db::init_db` |
| lib/*.rs | `super::module` | `crate::AppState` | `super::models::todo::Todo` |
| lib/subdir/*.rs | `super::super::module` | `crate::AppState` | `super::super::entities::todo` |

## 优点

1. **结构清晰**：所有业务逻辑代码都在 `lib/` 目录下
2. **职责分明**：
   - `main.rs` - 仅负责启动应用
   - `lib.rs` - 库入口，声明模块和导出公共 API
   - `lib/` - 所有具体实现
3. **易于维护**：模块组织更加直观，便于理解项目结构
4. **符合 Rust 惯例**：遵循 Rust 的模块组织最佳实践

## 条件编译支持

系统托盘模块保持条件编译，仅在桌面平台编译：

```rust
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod tray;
```

在代码中使用：

```rust
#[cfg(not(any(target_os = "android", target_os = "ios")))]
if let Err(e) = lib::tray::create_tray(&handle) {
    eprintln!("Failed to create system tray: {}", e);
}
```

## 兼容性

所有功能保持完全兼容：
- ✅ 编译通过
- ✅ 所有命令正常工作
- ✅ 跨平台支持保持不变
- ✅ 公共 API 保持向后兼容

## 验证

```bash
# 检查编译
cd src-tauri
cargo check

# 运行应用
cd ..
pnpm tauri dev

# 构建生产版本
pnpm tauri build
```

---

**重构完成日期**: 2025-11-04
