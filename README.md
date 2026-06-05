架构概览
comclean/
├── main.js               # Electron 主进程（窗口管理、IPC通信）
├── preload.js             # 安全桥接层
├── package.json           # 项目配置（npm start 即可本地运行）
├── 启动ComClean.bat       # 一键启动脚本
├── src/
│   ├── index.html         # 主界面
│   ├── styles.css         # 样式表（自定义无框窗口、动画）
│   └── renderer.js        # 前端交互逻辑
├── backend/
│   └── cleaner.js         # 扫描+清理引擎（10类垃圾）
└── dist/win-unpacked

清理项目（10类，安全保守模式）
类别	说明	需要管理员
📁 用户临时文件	%TEMP%	✗
⚙️ 系统临时文件	C:\Windows\Temp	✓
♻️ 回收站	清空回收站	✓
🖼️ 缩略图缓存	重建缩略图	✗
🌐 浏览器缓存	Chrome / Edge 缓存	✗
📄 最近文档记录	清除历史记录	✗
🌍 DNS缓存	ipconfig /flushdns	✓
⚠️ Windows错误报告	WER 日志	✗
🎮 DirectX着色器缓存	应用缓存	✗
📦 Delivery Optimization	更新分发缓存	✓
交互流程
打开应用 → 点击 🔍 开始扫描
等待扫描完成（自动遍历所有目录）
查看结果 → 点击 🧹 一键清理
清理完成后显示释放空间与详情
界面是无框窗口 + 自定义标题栏，有进度动画和渐变过渡效果，用起来很顺滑。

关于打包说明
electron-builder 的单文件 portable exe 需要下载 winCodeSign 签名工具链，当前环境无法创建符号链接导致那一步失败了，但 win-unpacked 版本的 ComClean.exe 是完整可用的。你可以直接把这个文件夹复制到 U盘 或别的电脑上运行。

