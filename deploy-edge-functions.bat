@echo off
echo ========================================
echo 部署 Edge Functions 到新项目
echo ========================================
echo.

echo 正在链接到新项目...
call npx supabase link --project-ref hntiihuxqlklpiyqmlob

echo.
echo 部署 wechat-quick-login...
call npx supabase functions deploy wechat-quick-login --no-verify-jwt

echo.
echo 部署 view-contact...
call npx supabase functions deploy view-contact --no-verify-jwt

echo.
echo 部署 recharge-request...
call npx supabase functions deploy recharge-request --no-verify-jwt

echo.
echo 部署 publish-post...
call npx supabase functions deploy publish-post --no-verify-jwt

echo.
echo 部署 toggle-post-status...
call npx supabase functions deploy toggle-post-status --no-verify-jwt

echo.
echo 部署 process-referral-reward...
call npx supabase functions deploy process-referral-reward --no-verify-jwt

echo.
echo ========================================
echo 部署完成！
echo ========================================
echo.
echo 接下来请在 Supabase Dashboard 设置以下 Secrets:
echo 1. WECHAT_MINIPROGRAM_APPID = wx0414f85654e5815f
echo 2. WECHAT_MINIPROGRAM_SECRET = (你的小程序密钥)
echo.
echo Dashboard 地址: https://supabase.com/dashboard/project/hntiihuxqlklpiyqmlob/settings/functions
echo.
pause
