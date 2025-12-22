@echo off
echo ========================================
echo 测试新项目配置
echo ========================================
echo.

echo 项目信息:
echo - Project ID: hntiihuxqlklpiyqmlob
echo - URL: https://hntiihuxqlklpiyqmlob.supabase.co
echo - Region: ap-southeast-1
echo.

echo 测试 1: 检查 API 连接...
curl -s "https://hntiihuxqlklpiyqmlob.supabase.co/rest/v1/" -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudGlpaHV4cWxrbHBpeXFtbG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTE1ODksImV4cCI6MjA3OTU2NzU4OX0.yh4FiKZPUPR-G1LormpZuKGZIaF7eSRkDbZslvBJzhc"
echo.
echo.

echo 测试 2: 检查收款二维码表...
curl -s "https://hntiihuxqlklpiyqmlob.supabase.co/rest/v1/payment_qrcodes?select=*" -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudGlpaHV4cWxrbHBpeXFtbG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTE1ODksImV4cCI6MjA3OTU2NzU4OX0.yh4FiKZPUPR-G1LormpZuKGZIaF7eSRkDbZslvBJzhc"
echo.
echo.

echo 测试 3: 列出 Edge Functions...
npx supabase functions list --project-ref hntiihuxqlklpiyqmlob
echo.

echo ========================================
echo 测试完成
echo ========================================
pause
