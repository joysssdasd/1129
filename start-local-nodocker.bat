@echo off
REM 老王我给你写个无Docker版本的本地开发启动脚本！

setlocal enabledelayedexpansion

REM 显示Logo
echo ╔═══════════════════════════════════════╗
echo ║     老王本地开发环境启动器              ║
echo ║     无Docker版 - 技术小白专用！          ║
echo ╚═══════════════════════════════════════╝
echo.

REM 检查Node.js
echo 🔍 检查Node.js环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js未安装！请先安装Node.js 18+
    pause
    exit /b 1
)

REM 检查pnpm
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pnpm未安装！正在安装...
    npm install -g pnpm
)

REM 检查环境变量文件
if not exist ".env.local" (
    echo ⚠️  未找到.env.local文件，使用默认配置
    copy ".env.example" ".env.local"
)

echo ✅ 环境检查完成
echo.

REM 显示服务信息
echo 📋 服务信息：
echo    • 前端应用: http://localhost:5173
echo    • Supabase数据库: 使用云端配置
echo    • 自动提交服务: 监控代码变更
echo.

REM 选择启动模式
echo 请选择启动模式：
echo 1) 仅前端应用
echo 2) 前端 + 自动提交服务
echo 3) 仅自动提交服务
echo 4) 查看服务状态
echo 5) 停止所有服务
echo.

set /p choice="请输入选择 (1-5): "

if "%choice%"=="1" goto frontend
if "%choice%"=="2" goto both
if "%choice%"=="3" goto autocommit
if "%choice%"=="4" goto status
if "%choice%"=="5" goto stop
goto invalid

:frontend
echo 🚀 启动前端应用...
cd trade-platform
echo 📦 安装依赖...
pnpm install
echo 🎯 启动开发服务器...
start "Frontend" pnpm dev
goto success

:both
echo 🚀 启动前端应用和自动提交服务...
cd trade-platform
echo 📦 安装前端依赖...
pnpm install
echo 🎯 启动前端服务器...
start "Frontend" pnpm dev
cd ..
echo 🔧 启动自动提交服务...
start "AutoCommit" node auto-commit.js
goto success

:autocommit
echo 🔧 启动自动提交服务...
start "AutoCommit" node auto-commit.js
goto success

:status
echo 📊 当前运行的服务：
tasklist | findstr "node" >nul
if not errorlevel 1 (
    echo ✅ Node.js进程正在运行
    tasklist | findstr "node"
) else (
    echo ❌ 没有运行中的Node.js进程
)
echo.
REM 检查端口占用
netstat -ano | findstr ":5173" >nul
if not errorlevel 1 (
    echo ✅ 端口5173已被占用（前端可能正在运行）
) else (
    echo ❌ 端口5173未被占用
)
goto end

:stop
echo 🛑 停止所有Node.js服务...
taskkill /f /im node.exe >nul 2>&1
echo ✅ 所有Node.js服务已停止
goto end

:invalid
echo ❌ 无效选择！
goto end

:success
echo ✅ 服务启动完成！
echo.
echo 🎉 开发环境启动完成！
echo.
echo 🔗 访问链接：
echo    • 前端应用: http://localhost:5173
echo    • API文档: http://localhost:5173/api-docs
echo.
echo 📝 有用的命令：
echo    • 查看服务状态: start-local-nodocker.bat 选择 4
echo    • 停止所有服务: start-local-nodocker.bat 选择 5
echo    • 查看前端日志: 查看启动的命令行窗口
echo.
echo 💻 老王祝你开发愉快！

:end
pause