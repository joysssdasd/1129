@echo off
REM 老王我给你写个Windows版本地开发启动脚本！

setlocal enabledelayedexpansion

REM 显示Logo
echo ╔═══════════════════════════════════════╗
echo ║     老王本地开发环境启动器              ║
echo ║     Windows版 - 技术小白专用！           ║
echo ╚═══════════════════════════════════════╝
echo.

REM 检查Docker
echo 🔍 检查Docker环境...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker未安装！请先安装Docker Desktop
    pause
    exit /b 1
)

REM 检查Docker Compose
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker Compose未安装！请先安装Docker Compose
        pause
        exit /b 1
    )
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
echo    • 数据库管理: http://localhost:8080 (需要启动tools)
echo    • Redis管理: http://localhost:8081 (需要启动tools)
echo    • 数据库: localhost:5432
echo    • Redis: localhost:6379
echo.

REM 选择启动模式
echo 请选择启动模式：
echo 1) 完整环境 (前端 + 数据库 + Redis)
echo 2) 仅数据库和Redis (后端服务)
echo 3) 仅前端 (需要外部数据库)
echo 4) 开发工具 (数据库管理界面)
echo 5) 停止所有服务
echo 6) 重启所有服务
echo.

set /p choice="请输入选择 (1-6): "

if "%choice%"=="1" goto full
if "%choice%"=="2" goto backend
if "%choice%"=="3" goto frontend
if "%choice%"=="4" goto tools
if "%choice%"=="5" goto stop
if "%choice%"=="6" goto restart
goto invalid

:full
echo 🚀 启动完整开发环境...
docker-compose -f docker-compose.local.yml up -d
goto success

:backend
echo 🚀 启动数据库和Redis...
docker-compose -f docker-compose.local.yml up -d postgres-dev redis-dev
goto success

:frontend
echo 🚀 启动前端应用...
docker-compose -f docker-compose.local.yml up -d frontend-dev
goto success

:tools
echo 🚀 启动开发工具...
docker-compose -f docker-compose.local.yml --profile tools up -d adminer redis-commander
goto success

:stop
echo 🛑 停止所有服务...
docker-compose -f docker-compose.local.yml down
echo ✅ 所有服务已停止
goto end

:restart
echo 🔄 重启所有服务...
docker-compose -f docker-compose.local.yml down
timeout /t 2 /nobreak >nul
docker-compose -f docker-compose.local.yml up -d
goto success

:invalid
echo ❌ 无效选择！
pause
exit /b 1

:success
echo ✅ 服务启动完成！
echo.

REM 等待服务启动
echo ⏳ 等待服务启动...
timeout /t 5 /nobreak >nul

REM 显示服务状态
echo 📊 服务状态：
docker-compose -f docker-compose.local.yml ps
echo.

REM 显示访问链接
echo 🎉 开发环境启动完成！
echo.
echo 🔗 访问链接：
echo    • 前端应用: http://localhost:5173
echo    • API文档: http://localhost:5173/api-docs

REM 检查管理工具
docker ps | findstr "trade-platform-adminer" >nul
if not errorlevel 1 (
    echo    • 数据库管理: http://localhost:8080
    echo        - 服务器: postgres-dev
    echo        - 用户名: postgres
    echo        - 密码: local_password_123
    echo        - 数据库: trade_platform_local
)

docker ps | findstr "trade-platform-redis-commander" >nul
if not errorlevel 1 (
    echo    • Redis管理: http://localhost:8081
)

echo.
echo 📝 有用的命令：
echo    • 查看日志: docker-compose -f docker-compose.local.yml logs -f [服务名]
echo    • 进入容器: docker exec -it [容器名] bash
echo    • 备份数据库: scripts\backup-db.bat
echo    • 恢复数据库: scripts\restore-db.bat
echo    • 停止服务: start-local.bat 选择 5
echo.
echo 💻 老王祝你开发愉快！

:end
pause