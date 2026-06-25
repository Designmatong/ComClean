<h1 align="center">
  🧹 ComClean
</h1>

<p align="center">
  <strong>C 盘一键清理工具 — 安全 · 快速 · 现代</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows%2010%2B-0078d4?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/build-electron-9feaf9?style=flat-square" alt="Built with Electron">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
</p>

<!-- Empty line for spacing -->
<p align="center">
  <em>C 盘垃圾一键清理 · Electron 桌面应用 · 10 类安全清理项</em>
</p>

---

## ✨ 功能特点

- **一键扫描** — 自动遍历 10 类常见垃圾位置，秒级完成分析
- **一键清理** — 扫描结果一目了然，点击即可安全释放磁盘空间
- **安全保守** — 只清理公认安全的临时文件、缓存与日志，不动系统核心
- **现代界面** — 无边框窗口 + 自定义标题栏，流畅动画过渡
- **智能权限** — 普通模式可清理用户级垃圾；管理员模式直达系统缓存

## 🗑️ 清理范围

| 类别 | 说明 | 需管理员 |
|------|------|:-------:|
| 📁 用户临时文件 | `%TEMP%` 环境变量目录 | ✗ |
| ⚙️ 系统临时文件 | `C:\Windows\Temp` | ✓ |
| ♻️ 回收站 | 清空回收站 | ✓ |
| 🖼️ 缩略图缓存 | 图标与缩略图缓存数据库 | ✗ |
| 🌐 浏览器缓存 | Chrome / Edge 缓存 | ✗ |
| 📄 最近文档记录 | 快捷方式历史记录 | ✗ |
| 🌍 DNS 缓存 | `ipconfig /flushdns` | ✓ |
| ⚠️ Windows 错误报告 | WER 本地存档日志 | ✗ |
| 🎮 DirectX 着色器缓存 | 应用着色器缓存 | ✗ |
| 📦 Delivery Optimization | Windows 更新分发缓存 | ✓ |

> 默认启用**安全保守模式**，所有项目均在成熟社区的推荐安全清单内。

## 🚀 快速上手

### 下载即用

从 [Releases](https://github.com/Designmatong/ComClean/releases) 下载最新版本，解压后双击 `ComClean.exe` 即可运行。

> 推荐**右键 → 以管理员身份运行**，可获得更彻底的清理效果。

### 或从源码构建

```bash
git clone https://github.com/Designmatong/ComClean.git
cd ComClean
npm install

# 开发模式运行
npm start

# 打包为便携版 exe
npm run dist
```

## 🖥️ 使用流程

```
打开应用  →  点击「开始扫描」  →  查看分析结果  →  点击「一键清理」
   ↓              ↓                  ↓                 ↓
  就绪         扫描动画          各类大小与数量      释放空间汇总
             带实时进度条         可释放空间汇总      逐项清理详情
```

## 🏗️ 项目架构

```
ComClean/
├── main.js                 # Electron 主进程
│   ├── 窗口创建与管理
│   ├── IPC 通信路由
│   └── 权限检测与提权
├── preload.js              # 安全桥接层 (contextBridge)
├── backend/
│   └── cleaner.js          # 核心引擎
│       ├── 10 类垃圾路径定义
│       ├── 递归目录扫描 & 大小计算
│       ├── 文件安全删除
│       └── DNS/回收站系统操作
├── src/
│   ├── index.html          # 主界面 DOM
│   ├── styles.css          # 全部样式（含动画）
│   └── renderer.js         # 前端交互逻辑
│       ├── 扫描/清理状态机
│       ├── 动画控制
│       └── 结果渲染
├── dist/win-unpacked/      # 打包后的可执行文件
└── 启动ComClean.bat        # 一键启动脚本
```

### 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 42 |
| 前端 | HTML5 + CSS3 + Vanilla JS |
| 后端 | Node.js (fs, child_process) |
| 打包 | electron-builder → 便携版 exe |

## ⚡ 性能

- **扫描速度**：百兆级缓存目录约 1–3 秒
- **应用体积**：约 220 MB（含 Electron 运行时）
- **内存占用**：闲置约 60 MB，扫描时约 100 MB
- **启动时间**：< 2 秒（SSD）

## 🤝 贡献

欢迎提交 [Issue](https://github.com/Designmatong/ComClean/issues) 或 Pull Request。如果你想增加新的清理类别或优化界面，请先开 Issue 讨论。

## 📄 许可

MIT License © 2025 Designmatong

---

<p align="center">
  <sub>Built with ❤️ using Electron &amp; Node.js</sub>
</p>
