@echo off
chcp 65001 >nul
echo ========================================
echo   微信群消息自动采集工具
echo ========================================
echo.

REM 检查Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Python，请先安装Python 3.8+
    pause
    exit /b 1
)

REM 检查配置文件
if not exist config.json (
    echo [提示] 配置文件不存在，正在创建...
    copy config.example.json config.json
    echo.
    echo 请编辑 config.json 文件，填写以下配置：
    echo   1. wechat.data_path - 微信数据目录
    echo   2. platform.supabase_url - Supabase项目URL
    echo   3. platform.supabase_anon_key - Supabase API密钥
    echo   4. platform.user_id - 你的用户ID
    echo   5. ai.deepseek_api_key - DeepSeek API密钥
    echo.
    pause
    exit /b 0
)

REM 检查依赖
echo [1/2] 检查依赖...
pip show loguru >nul 2>&1
if errorlevel 1 (
    echo 正在安装依赖...
    pip install -r requirements.txt
)

REM 创建日志目录
if not exist logs mkdir logs

REM 启动程序
echo [2/2] 启动采集程序...
echo.
python main.py

pause
