@echo off
chcp 65001 >nul
title 老王的自动提交服务

echo.
echo 🤖 老王的自动提交服务启动器
echo ================================
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：未检测到Node.js
    echo 请先安装Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js已安装
echo.

REM 检查是否设置了GitHub Token
if "%GITHUB_TOKEN%"=="" (
    echo ⚠️  警告：未设置GITHUB_TOKEN环境变量
    echo.
    echo 请按以下步骤设置：
    echo 1. 获取GitHub Personal Access Token
    echo 2. 运行: set GITHUB_TOKEN="your_token_here"
    echo 3. 重新启动此脚本
    echo.
    set /p continue="是否继续启动服务？(y/n): "
    if /i not "%continue%"=="y" exit /b 1
)

echo 🚀 启动自动提交服务...
echo.
echo 💡 提示：
echo - 服务将监控 trade-platform 目录
echo - 每30秒检查一次文件变化
echo - 按 Ctrl+C 停止服务
echo.

REM 启动Node.js服务
node auto-commit.js

echo.
echo 服务已停止
pause