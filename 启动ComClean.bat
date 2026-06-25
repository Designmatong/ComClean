@echo off
chcp 65001 >nul
title ComClean - C盘清理
echo ========================================
echo    ComClean - C盘一键清理工具 v1.1.0
echo ========================================
echo.

REM 清除 ELECTRON_RUN_AS_NODE，否则 Electron 无法正常工作
set ELECTRON_RUN_AS_NODE=

echo 正在启动...
echo 推荐：右键本文件 → 以管理员身份运行
echo.

if exist "%~dp0dist\ComClean 1.1.0.exe" (
    start "" "%~dp0dist\ComClean 1.1.0.exe"
) else if exist "%~dp0dist\win-unpacked\ComClean.exe" (
    start "" "%~dp0dist\win-unpacked\ComClean.exe"
) else (
    echo 错误：找不到 ComClean.exe
    echo 请先运行 npm run pack 进行构建
    pause
)
echo 已启动
