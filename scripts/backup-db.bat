@echo off
REM 老王我给你写个Windows版数据库备份脚本！

setlocal enabledelayedexpansion

REM 配置
set CONTAINER_NAME=trade-platform-postgres-dev
set DB_NAME=trade_platform_local
set DB_USER=postgres
set BACKUP_DIR=..\backups

REM 创建备份目录
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM 生成时间戳
for /f "tokens=2 delims==" %%I in ('wmic os get LocalDateTime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%%datetime:~4,2%%datetime:~6,2%_%datetime:~8,2%%datetime:~10,2%%datetime:~12,2%
set BACKUP_FILE=%BACKUP_DIR%\backup_%TIMESTAMP%.sql

echo 🔄 开始备份数据库...

REM 检查容器是否运行
docker ps | findstr "%CONTAINER_NAME%" >nul
if errorlevel 1 (
    echo ❌ 数据库容器未运行！请先启动本地开发环境
    pause
    exit /b 1
)

REM 执行备份
docker exec %CONTAINER_NAME% pg_dump -U %DB_USER% %DB_NAME% > %BACKUP_FILE%

if not errorlevel 1 (
    echo ✅ 数据库备份成功！
    echo 📍 备份文件位置: %BACKUP_FILE%

    REM 显示文件大小
    for %%F in ("%BACKUP_FILE%") do (
        echo 💾 文件大小: %%~zF 字节
    )

    REM 清理7天前的备份文件
    forfiles /p "%BACKUP_DIR%" /m "backup_*.sql" /d -7 /c "cmd /c del @path" 2>nul
    if not errorlevel 1 (
        echo 🧹 已清理7天前的旧备份文件
    )
) else (
    echo ❌ 数据库备份失败！
    pause
    exit /b 1
)

pause