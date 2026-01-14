@echo off
echo ========================================
echo 部署注册相关的 Edge Functions
echo ========================================

echo.
echo 1. 部署 auth-register 函数...
npx supabase functions deploy auth-register --no-verify-jwt

echo.
echo 2. 部署 register-with-password 函数...
npx supabase functions deploy register-with-password --no-verify-jwt

echo.
echo 3. 部署 wechat-quick-login 函数...
npx supabase functions deploy wechat-quick-login --no-verify-jwt

echo.
echo 4. 部署 wechat-login 函数...
npx supabase functions deploy wechat-login --no-verify-jwt

echo.
echo 5. 部署 process-referral-reward 函数...
npx supabase functions deploy process-referral-reward --no-verify-jwt

echo.
echo ========================================
echo 部署完成！
echo ========================================
echo.
echo 请在 Supabase SQL Editor 中执行以下迁移脚本修复已有用户的积分：
echo supabase/migrations/20260114_fix_user_points_default.sql
echo.
pause
