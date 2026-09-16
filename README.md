# 🐾 小落同学 - 桌面宠物

基于 Electron + Live2D + PIXI.js 的桌面宠物应用，支持 Live2D 模型展示、智能对话、任务管理等功能。

![Electron](https://img.shields.io/badge/Electron-31.0-blue)
![Live2D](https://img.shields.io/badge/Live2D-Cubism4-green)
![PIXI.js](https://img.shields.io/badge/PIXI.js-5.x-orange)

## ✨ 功能特性

### 🎭 Live2D 模型展示
- 支持 Cubism 4 模型的加载与渲染
- 模型点击互动（TapBody 动画）
- 待机动画自动轮播
- 可调节模型大小（大/中/小三档）
- 支持自定义模型目录

### 🖱️ 窗口交互
- **拖拽移动**：拖动桌宠窗口移动位置
- **边缘吸附**：拖动至屏幕边缘自动隐藏为小标签
- **悬停预览**：鼠标悬停隐藏标签展开预览
- **点击菜单**：单击桌宠打开圆盘菜单
- **双击聊天**：双击桌宠打开对话窗口
- **系统托盘**：支持托盘快捷操作

### 💬 智能对话
- WebSocket 实时通信
- 流式输出响应
- 聊天记录保存与加载
- 底部字幕实时显示
- 支持后端地址动态切换与自动重连

### 🎯 圆盘菜单
单击桌宠展开的环形菜单，包含以下功能：
- **📑 书签收藏**：管理收藏的网页链接
- **⏰ 提醒待办**：添加和管理提醒事项（支持公历/农历、重复周期）
- **📋 定时任务**：创建一次性或循环定时任务
- **⚡ 技能说明**：查看和调用 MCP 工具技能
- **⚙️ 设置**：打开设置面板
- **🔑 登录**：登录认证（根据登录状态动态显示/隐藏）
- **🚪 退出**：退出桌面宠物

### 📋 任务管理
#### 提醒待办
- 多类别管理（工作、生活、学习等）
- 支持公历/农历日期
- 重复周期设置（一次性/每天/每周/每月/每年）
- 编辑和删除提醒

#### 定时任务
- 一次性任务和循环任务
- 多种频率选项（每天/每周/每月/每年）
- 自定义星期、日期、时间
- 时区支持
- 重试机制（最大重试次数、重试间隔、超时设置）
- 通知集成

### 🔧 MCP 技能系统
- 从后端获取可用技能列表
- 可视化技能展示
- 支持多种参数格式（args 列表/JSON Schema）
- 工具调用对话框
- 实时显示调用结果

### ⚙️ 设置系统
#### 网络设置
- 后端服务地址配置
- WebSocket 自动重连

#### 外观设置
- 桌宠大小调节（大/中/小）
- 窗口边框显示
- 待机动画间隔和概率

#### 行为设置
- 自动走来走去功能
- 走动参数配置（空闲时间、最大距离、速度）

#### 模型管理
- 本地模型扫描和切换
- 远程模型下载
- 自定义模型目录设置

#### 边缘设置
- 边缘行为配置（无/隐藏/吸附）

### 🚶 自动走动
- 桌宠自动在屏幕范围内随机移动
- 支持模型朝向自动翻转
- 可配置的移动距离和速度
- 闲时自动触发

### 🔔 通知系统
- Toast 弹窗通知
- 通知队列管理
- 点击标记已读
- 独立通知窗口

### 🔐 用户认证
- Electron Session Cookie 管理
- 登录窗口自动检测
- WebSocket 认证连接
- 登录状态自动同步

## 📁 项目结构

```
desktop_pet/
├── main.js                 # Electron 主进程
├── preload.js              # 预加载脚本（IPC 桥接）
├── pet.js                  # 渲染进程主入口
├── index.html              # 主页面
├── toast.html              # 通知窗口页面
├── package.json            # 项目配置
├── .env                    # 环境变量
├── lib/                    # 前端模块
│   ├── pet-common.js       # 公共工具模块
│   ├── pet-core.js         # 核心模块（PIXI、模型加载、拖拽）
│   ├── pet-radial-menu.js  # 圆盘菜单
│   ├── pet-chat.js         # 聊天对话
│   ├── pet-panels.js       # 面板系统（收藏、提醒、任务）
│   ├── pet-settings.js     # 设置管理
│   ├── pet-wander.js       # 走动功能
│   ├── pet-mcp.js          # MCP 技能
│   ├── pet-notifications.js # 通知系统
│   ├── pixi.min.js         # PIXI.js 渲染引擎
│   ├── live2dcubismcore.min.js  # Live2D Core
│   ├── cubism4.min.js      # Cubism 4 支持
│   └── pixi-live2d-display.min.js  # Live2D 显示库
├── models/                 # 内置模型
│   ├── Hiyori/             # Hiyori 模型
│   └── Mao/                # Mao 模型
├── resources/              # 资源文件（图标等）
├── electron/               # Electron 运行时（开发环境）
├── tests/                  # 测试文件
└── docs/                   # 文档
```

## 🚀 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn
- Windows/macOS/Linux

### 安装依赖

```bash
npm install
```

### 启动应用

```bash
npm start
```

或使用批处理文件（Windows）：

```bash
start.bat
```

### 开启调试模式

在 `.env` 文件中设置：

```env
DEBUG_MODE=1
```

或在环境变量中设置 `DEBUG_MODE=1`，启动时会自动打开开发者工具。

## 🔧 配置说明

### 配置文件路径

```
C:\Users\[用户名]\AppData\Roaming\[应用名称]\pet-config.json
```

例如：
```
C:\Users\Administrator\AppData\Roaming\odd-desktop-pet\pet-config.json
```

### 配置项说明

配置文件存储了以下设置：
- `base_url`：后端服务地址（默认 `http://127.0.0.1:8000`）
- `customModelsDir`：用户自定义模型目录路径
- `pet_size`：桌宠大小（`large`/`medium`/`small`）
- `currentModelPath`：当前使用的模型路径
- 其他用户自定义设置项

### Live2D 模型查找顺序

查找模型文件，优先级：
1. `.model3.json`（Cubism 4 模型文件）
2. `index.json`
3. `model.json`

### 模型目录

默认模型目录路径：
```
/media/live2d/models/
```

模型文件夹结构示例：
```
models/
└── Hiyori/
    ├── Hiyori.model3.json    # 模型定义文件
    ├── Hiyori.moc3           # 模型数据
    ├── Hiyori.cdi3.json      # 画布信息
    ├── Hiyori.physics3.json  # 物理引擎
    ├── Hiyori.pose3.json     # 姿势设置
    ├── Hiyori.userdata3.json # 用户数据
    ├── Hiyori.2048/          # 纹理贴图
    │   ├── texture_00.png
    │   └── texture_01.png
    └── motions/              # 动作文件
        ├── Hiyori_m01.motion3.json
        └── ...
```

## 🎮 使用说明

### 基本操作

| 操作 | 功能 |
|------|------|
| 拖动桌宠 | 移动位置 |
| 单击桌宠 | 打开圆盘菜单 |
| 双击桌宠 | 打开/关闭聊天窗口 |
| 点击模型身体 | 播放互动动画 |
| 拖至屏幕边缘 | 自动隐藏为标签 |
| 悬停隐藏标签 | 展开预览 |
| 点击隐藏标签 | 恢复显示 |
| ESC 键 | 关闭圆盘菜单/面板 |

### 圆盘菜单操作

| 菜单项 | 功能 |
|--------|------|
| 📑 书签收藏 | 添加和管理收藏链接 |
| ⏰ 提醒待办 | 创建和管理提醒 |
| 📋 定时任务 | 设置定时执行的任务 |
| ⚡ 技能说明 | 查看和调用 MCP 技能 |
| ⚙️ 设置 | 打开设置面板 |
| 🔑 登录 | 登录认证（未登录时显示） |
| 🚪 退出 | 退出应用 |

### 聊天功能

1. **双击桌宠** 打开聊天窗口
2. 在输入框输入文字，按回车或点击发送按钮发送
3. 助手回复以流式输出显示
4. 回复内容同时显示在底部字幕条
5. 点击关闭按钮或再次双击关闭聊天窗口

## 🌐 后端服务

本应用需要配合后端服务使用，后端提供以下 API：

- 用户认证（`/admin/login`）
- 聊天对话（`/api/chat/history/`）
- WebSocket 实时通信（`/ws/`）
- 书签收藏（`/api/markit/`）
- 提醒待办（`/api/reminder/`）
- 定时任务（`/api/schedule/`）
- MCP 技能（`/admin/api/mcp/list`）
- 模型管理（`/admin/api/live2d/model/`）
- 通知系统（`/api/notifications/`）

后端地址可在设置中配置，默认为 `http://127.0.0.1:8000`。

## 🛠️ 开发说明

### 技术栈

- **Electron 31**：跨平台桌面应用框架
- **PIXI.js 5**：2D 渲染引擎
- **Live2D Cubism 4**：2D 模型动画
- **pixi-live2d-display**：PIXI.js 的 Live2D 插件
- **原生 HTTP Server**：主进程内置服务器

### 架构设计

```
┌─────────────────────────────────────────────┐
│                  主进程 (main.js)             │
│  - HTTP 服务器（静态文件服务）                 │
│  - 窗口管理（透明无边框窗口）                  │
│  - 边缘吸附动画                               │
│  - IPC 通信处理                              │
│  - Cookie 管理                               │
│  - 模型下载与解压                            │
│  - Toast 通知窗口                            │
│  - 系统托盘                                  │
└──────────────────┬──────────────────────────┘
                   │ IPC
┌──────────────────┴──────────────────────────┐
│              预加载脚本 (preload.js)           │
│  - 安全桥接（contextIsolation）               │
│  - window.petAPI 暴露                         │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│             渲染进程 (pet.js)                 │
│  ┌────────────────────────────────────┐     │
│  │  PetCore (核心)                     │     │
│  │  - PIXI 初始化                     │     │
│  │  - Live2D 模型加载                 │     │
│  │  - 拖拽交互                        │     │
│  └────────────────────────────────────┘     │
│  ┌────────────────────────────────────┐     │
│  │  功能模块                           │     │
│  │  - PetRadialMenu (圆盘菜单)         │     │
│  │  - PetChat (聊天对话)              │     │
│  │  - PetPanels (面板系统)            │     │
│  │  - PetSettings (设置管理)          │     │
│  │  - PetWander (走动功能)            │     │
│  │  - PetMCP (技能系统)               │     │
│  │  - PetNotifications (通知)         │     │
│  └────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

### 模块说明

| 模块 | 文件 | 职责 |
|------|------|------|
| 核心模块 | `pet-core.js` | PIXI 初始化、Live2D 模型加载、动画控制、窗口拖拽 |
| 圆盘菜单 | `pet-radial-menu.js` | 环形菜单的显示、隐藏、事件处理 |
| 聊天对话 | `pet-chat.js` | WebSocket 通信、消息收发、流式输出、字幕显示 |
| 面板系统 | `pet-panels.js` | 通用面板、收藏、提醒、任务管理 |
| 设置管理 | `pet-settings.js` | 设置面板 UI、设置读写 |
| 走动功能 | `pet-wander.js` | 自动走动、边缘隐藏/恢复 |
| MCP 技能 | `pet-mcp.js` | 技能列表、工具调用 |
| 通知系统 | `pet-notifications.js` | 通知接收、Toast 显示 |
| 公共模块 | `pet-common.js` | 工具函数、API 请求、模板管理 |

### 打包应用

使用 electron-builder 打包（需先安装）：

```bash
npm install electron-builder --save-dev
```

在 `package.json` 中添加：

```json
{
  "build": {
    "appId": "com.oddmeta.desktop-pet",
    "productName": "小落同学",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "pet.js",
      "index.html",
      "toast.html",
      "lib/**/*",
      "models/**/*",
      "resources/**/*",
      "toast-preload.js"
    ],
    "win": {
      "icon": "resources/icon.ico",
      "target": "nsis"
    }
  }
}
```

然后执行：

```bash
npx electron-builder
```

## 📝 开发日志

详细的变更记录和技术文档请查看 `docs/` 目录：

- [CHANGELOG_CHAT_UI_V2.md](docs/CHANGELOG_CHAT_UI_V2.md) - 聊天界面改版
- [CHANGELOG_CLICK_MENU.md](docs/CHANGELOG_CLICK_MENU.md) - 单击菜单功能
- [CHANGELOG_DBLCLICK_CHAT.md](docs/CHANGELOG_DBLCLICK_CHAT.md) - 双击聊天功能
- [CHANGELOG_HOVER_MENU.md](docs/CHANGELOG_HOVER_MENU.md) - 悬停菜单设计
- [CHANGELOG_MARKDOWN_CHAT.md](docs/CHANGELOG_MARKDOWN_CHAT.md) - Markdown 聊天支持
- [CHANGELOG_RADIAL_MENU.md](docs/CHANGELOG_RADIAL_MENU.md) - 圆盘菜单功能
- [DIRECTORY_STRUCTURE.md](docs/DIRECTORY_STRUCTURE.md) - 目录结构说明
- [MENU_ACTION_MAPPING.md](docs/MENU_ACTION_MAPPING.md) - 菜单动作映射
- [RADIAL_MENU_README.md](docs/RADIAL_MENU_README.md) - 圆盘菜单说明

## 📄 许可证

本项目仅供学习和研究使用。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

如有问题或建议，请通过 Issue 反馈。
