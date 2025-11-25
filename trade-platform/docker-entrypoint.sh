#!/bin/sh

# 老王我给你写个Docker入口脚本，让技术小白也能处理环境变量！

set -e

# 替换环境变量到HTML文件中
if [ -n "$VITE_SUPABASE_URL" ]; then
    echo "正在设置 Supabase URL..."
    find /usr/share/nginx/html -name "*.js" -type f -exec sed -i "s|VITE_SUPABASE_URL_PLACEHOLDER|$VITE_SUPABASE_URL|g" {} +
fi

if [ -n "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "正在设置 Supabase Anon Key..."
    find /usr/share/nginx/html -name "*.js" -type f -exec sed -i "s|VITE_SUPABASE_ANON_KEY_PLACEHOLDER|$VITE_SUPABASE_ANON_KEY|g" {} +
fi

# 设置环境变量
if [ -n "$NODE_ENV" ]; then
    export NODE_ENV
fi

echo "🚀 老王我配置完成，启动应用..."

# 启动nginx
exec "$@"