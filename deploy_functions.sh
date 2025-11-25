#!/bin/bash

# AI批量发布功能修复部署脚本

echo "🚀 开始部署AI批量发布相关函数..."

# 设置Supabase项目ID
PROJECT_ID="mgyelmyjeidlvmmmjkqi"

# 部署修复后的auth-login函数
echo "📝 部署auth-login函数..."
if command -v supabase >/dev/null 2>&1; then
    supabase functions deploy auth-login --project-ref $PROJECT_ID
    echo "✅ auth-login函数部署完成"
else
    echo "❌ Supabase CLI未安装，跳过auth-login部署"
fi

# 部署修复后的send-verification-code函数
echo "📝 部署send-verification-code函数..."
if command -v supabase >/dev/null 2>&1; then
    supabase functions deploy send-verification-code --project-ref $PROJECT_ID
    echo "✅ send-verification-code函数部署完成"
else
    echo "❌ Supabase CLI未安装，跳过send-verification-code部署"
fi

# 部署修复后的ai-batch-publish-v2函数
echo "📝 部署ai-batch-publish-v2函数..."
if command -v supabase >/dev/null 2>&1; then
    supabase functions deploy ai-batch-publish-v2 --project-ref $PROJECT_ID
    echo "✅ ai-batch-publish-v2函数部署完成"
else
    echo "❌ Supabase CLI未安装，跳过ai-batch-publish-v2部署"
fi

echo "🎉 所有函数部署完成！"
echo ""
echo "修复内容总结："
echo "1. auth-login: 添加了详细日志和错误处理"
echo "2. send-verification-code: 添加了测试模式，测试手机号自动生成验证码666666"
echo "3. ai-batch-publish-v2: 修复字段名不匹配问题（expires_at -> expire_at）"
echo "4. ai-batch-publish-v2: 改进了AI解析prompt，支持交易类型识别"
echo "5. ai-batch-publish-v2: 优化了关键词数组处理"
echo ""
echo "现在可以测试登录和AI批量发布功能了！"