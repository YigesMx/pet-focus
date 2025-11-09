# Pet Focus

<div align="center">

一个现代化的待办事项管理桌面应用，基于 Tauri 2.x + React + TypeScript 构建

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-blue)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Rust-2021-orange)](https://www.rust-lang.org/)

</div>

## ✨ 特性

### 🎯 核心功能

- **待办事项管理**
  - ✅ 创建、编辑、删除待办事项
  - ✅ 完成状态标记
  - ✅ 截止日期和提醒设置
  - ✅ 本地 SQLite 数据库存储

- **CalDAV 同步**
  - ☁️ 支持与 CalDAV 服务器双向同步
  - 🔄 自动定时同步（可配置间隔）
  - 🔀 智能冲突解决（Last-Write-Wins）
  - 📱 支持主流 CalDAV 服务（iCloud、NextCloud 等）

- **提醒系统**
  - ⏰ 智能提醒调度
  - 🔔 桌面通知
  - ⚡ 事件驱动自动更新

### 🌐 WebSocket API 服务器

- **实时双向通信**
  - 📡 基于 WebSocket 的 API（默认 `ws://127.0.0.1:8787/ws`）
  - 🔄 请求-响应模式
  - 📢 事件推送支持
  - 🎯 频道订阅机制

- **完整的 API**
  - 待办事项 CRUD 操作
  - 实时数据同步
  - 多客户端并发支持

详细 API 文档: [WEBSOCKET_API.md](./WEBSOCKET_API.md)

### 🖥️ 系统托盘（桌面平台）

- **跨平台支持**: macOS、Windows、Linux
- **后台运行**: 关闭窗口后程序继续运行
- **动态菜单**: 
  - 显示/隐藏窗口
  - 启动/停止 WebServer（状态感知）
  - 退出应用
- **左键唤醒**: 快速显示主窗口

### 🏗️ 模块化架构

- **Feature 模式**: 清晰的功能模块划分
- **Registry 模式**: 统一的命令和菜单管理
- **事件驱动**: 高效的数据同步机制
- **跨平台**: 桌面和移动端支持（Tauri Mobile Ready）

详细架构文档: [ARCHITECTURE.md](./ARCHITECTURE.md)

## 📸 截图

*TODO: 添加应用截图*

## 🚀 快速开始

### 前置要求

- **Node.js** >= 18
- **pnpm** >= 8
- **Rust** >= 1.70
- **Tauri CLI**: 自动安装

### 安装

1. **克隆仓库**
```bash
git clone https://github.com/YigesMx/pet-focus.git
cd pet-focus
```

2. **安装依赖**
```bash
pnpm install
```

3. **开发模式**
```bash
pnpm tauri dev
```

4. **构建生产版本**
```bash
pnpm tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`

### 配置

#### CalDAV 同步设置

1. 打开应用设置
2. 填写 CalDAV 服务器信息:
   - **服务地址**: CalDAV 服务器 URL
   - **用户名**: 账户用户名
   - **密码**: 账户密码或应用专用密码
3. 设置同步间隔（1-1440 分钟）
4. 点击"保存配置"

**支持的服务**:
- iCloud Calendar
- NextCloud
- Radicale
- 其他标准 CalDAV 服务器

#### WebServer 自动启动

应用设置中配置 `webserver.auto_start`:
```typescript
await invoke('set_caldav_sync_interval', { minutes: 30 });
```

## 📚 文档

- **[架构文档](./ARCHITECTURE.md)** - 详细的软件架构说明
- **[WebSocket API 文档](./WEBSOCKET_API.md)** - WebSocket API 完整参考
- **[系统托盘指南](./SYSTEM_TRAY_GUIDE.md)** - 托盘功能使用说明

## 🛠️ 技术栈

### 前端
- **[React 18](https://react.dev/)** - UI 框架
- **[TypeScript](https://www.typescriptlang.org/)** - 类型安全
- **[Vite](https://vitejs.dev/)** - 构建工具
- **[TanStack Query](https://tanstack.com/query)** - 数据管理
- **[Tailwind CSS](https://tailwindcss.com/)** - 样式框架
- **[shadcn/ui](https://ui.shadcn.com/)** - UI 组件库

### 后端
- **[Rust](https://www.rust-lang.org/)** - 核心语言
- **[Tauri 2.x](https://tauri.app/)** - 应用框架
- **[SeaORM](https://www.sea-ql.org/SeaORM/)** - 数据库 ORM
- **[Axum](https://github.com/tokio-rs/axum)** - WebSocket 服务器
- **[Tokio](https://tokio.rs/)** - 异步运行时
- **[SQLite](https://www.sqlite.org/)** - 本地数据库

## 🏗️ 项目结构

```
pet-focus/
├── src/                    # React 前端
│   ├── app/               # 应用层（页面、Providers）
│   ├── features/          # 功能模块（Todo、CalDAV、Settings）
│   ├── components/        # 共享 UI 组件
│   └── shared/            # 共享工具
├── src-tauri/             # Rust 后端
│   └── src/
│       ├── core/          # 核心模块（AppState、Feature Trait）
│       ├── features/      # 业务功能（Todo、Settings、Window）
│       └── infrastructure/ # 基础设施（Database、WebServer、Tray）
├── ARCHITECTURE.md        # 架构文档
├── WEBSOCKET_API.md       # API 文档
└── README.md             # 本文件
```

详见 [ARCHITECTURE.md](./ARCHITECTURE.md) 了解完整架构设计。

## 🤝 贡献

欢迎贡献! 请查看 [贡献指南](./CONTRIBUTING.md) (TODO)。

### 开发指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- **Rust**: 使用 `cargo fmt` 和 `cargo clippy`
- **TypeScript**: 遵循 ESLint 配置
- **提交消息**: 遵循 [Conventional Commits](https://www.conventionalcommits.org/)

## 📋 TODO

- [ ] Pomodoro 番茄钟功能
- [ ] 多语言支持 (i18n)
- [ ] 数据导入/导出
- [ ] 更多主题选项
- [ ] 移动端适配 (Tauri Mobile)
- [ ] 插件系统

## 📄 License

本项目采用 MIT 许可证 - 详见 [LICENSE](./LICENSE) 文件。

## 🙏 致谢

- [Tauri](https://tauri.app/) - 强大的桌面应用框架
- [shadcn/ui](https://ui.shadcn.com/) - 优秀的 UI 组件库
- 所有开源贡献者

## 💬 联系方式

- **作者**: YigesMx
- **GitHub**: [@YigesMx](https://github.com/YigesMx)
- **Issues**: [GitHub Issues](https://github.com/YigesMx/pet-focus/issues)

---

<div align="center">

**[⬆ 回到顶部](#pet-focus)**

Made with ❤️ by YigesMx

</div>

