# Pet Focus - Tauri + React + TypeScript

一个使用 Tauri、React 和 TypeScript 构建的待办事项管理应用，支持后台 RESTful API 服务器和系统托盘。

## 核心功能

### 🎯 待办事项管理
- 创建、编辑、删除待办事项
- 标记完成状态
- 本地数据库存储（SQLite）

### 🌐 RESTful API 服务器
- 内置 Axum Web 服务器
- 支持远程访问待办事项数据
- 默认运行在 `http://127.0.0.1:8787`

### 🖥️ 系统托盘
- **跨平台支持**：macOS、Windows、Linux
- **后台运行**：关闭窗口后程序继续在后台运行
- **左键唤醒**：点击托盘图标显示主窗口
- **右键菜单**：
  - 显示/隐藏窗口
  - 启动/停止 API 服务器
  - 退出应用程序

详细的系统托盘使用说明请参见 [SYSTEM_TRAY_GUIDE.md](./SYSTEM_TRAY_GUIDE.md)

## 推荐的 IDE 设置

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 开发

### 安装依赖
```bash
pnpm install
```

### 开发模式
```bash
pnpm tauri dev
```

### 构建生产版本
```bash
pnpm tauri build
```

## 技术栈

### 前端
- **React** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架

### 后端
- **Rust** - 核心语言
- **Tauri v2** - 应用框架
- **SeaORM** - 数据库 ORM
- **Axum** - Web 服务器框架
- **SQLite** - 本地数据库

## 项目结构

```
pet-focus/
├── src/                      # React 前端代码
│   ├── components/           # UI 组件
│   ├── features/             # 功能模块
│   └── lib/                  # 工具库
├── src-tauri/                # Rust 后端代码
│   ├── src/
│   │   ├── commands.rs       # Tauri 命令
│   │   ├── db.rs             # 数据库初始化
│   │   ├── tray.rs           # 系统托盘
│   │   ├── webserver/        # Web 服务器
│   │   ├── services/         # 业务逻辑
│   │   └── lib.rs            # 主入口
│   └── tauri.conf.json       # Tauri 配置
└── README.md
```

## License

This project is licensed under the MIT License.

