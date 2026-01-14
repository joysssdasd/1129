@echo off
chcp 65001 >nul
title 微信群消息自动采集工具

echo ================================================
echo   微信群消息自动采集工具
echo ================================================
echo.
echo 请选择运行模式:
echo   1. 剪贴板监控模式 (推荐)
echo   2. 文件监控模式
echo   3. 获取微信数据库密钥
echo   4. 退出
echo.

set /p choice=请输入选项 (1-4): 

if "%choice%"=="1" goto clipboard
if "%choice%"=="2" goto file
if "%choice%"=="3" goto getkey
if "%choice%"=="4" goto end

:clipboard
echo.
echo 启动剪贴板监控模式...
echo 复制交易信息到剪贴板即可自动采集
echo 每60分钟自动处理并发布
echo.
python auto_collect_enhanced.py --mode clipboard --interval 60
goto end

:file
echo.
set /p watchdir=请输入监控目录 (默认 ./messages): 
if "%watchdir%"=="" set watchdir=./messages
echo 启动文件监控模式...
echo 将交易信息保存为txt文件到 %watchdir% 目录
echo.
python auto_collect_enhanced.py --mode file --watch-dir "%watchdir%" --interval 60
goto end

:getkey
echo.
echo 正在获取微信数据库密钥...
echo 请确保微信已登录并运行中
echo.
python setup_and_decrypt.py
pause
goto end

:end
echo.
echo 程序已退出
pause
