@echo off
chcp 65001 >nul
echo ========================================
echo 板块功能部署脚本
echo ========================================
echo.

echo [1/4] 检查环境...
cd trade-platform
if not exist "node_modules" (
    echo 正在安装依赖...
    call pnpm install
)

echo.
echo [2/4] 构建前端...
call pnpm build:prod
if errorlevel 1 (
    echo ❌ 构建失败！
    pause
    exit /b 1
)

echo.
echo [3/4] 部署 Edge Function...
echo 提示：需要手动部署 publish-post 函数
echo 命令：supabase functions deploy publish-post
echo.

echo.
echo [4/4] 部署完成检查清单
echo.
echo ✅ 数据库迁移：已完成（通过MCP）
echo ⏳ Edge Function：需要手动部署
echo ✅ 前端构建：已完成
echo ⏳ 前端部署：需要上传到 EdgeOne Pages
echo.

echo ========================================
echo 📋 后续步骤：
echo ========================================
echo 1. 部署 publish-post Edge Function
echo 2. 上传 dist 文件夹到 EdgeOne Pages
echo 3. 执行测试（参考：板块功能测试指南.md）
echo 4. 验证所有功能正常
echo.

echo ========================================
echo 📚 相关文档：
echo ========================================
echo - 板块功能实施报告.md
echo - 板块功能测试指南.md
echo.

pause
