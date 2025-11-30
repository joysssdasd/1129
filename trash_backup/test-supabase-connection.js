// 🔍 老王的Supabase连接测试脚本（MCP版）
import { createClient } from '@supabase/supabase-js';

// 📝 使用项目中真实的Supabase配置
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 老王开始测试Supabase MCP连接...');
console.log('📍 项目URL:', supabaseUrl);
console.log('🔑 密钥状态:', supabaseAnonKey ? '✅ 已配置' : '❌ 未配置');

async function testSupabaseConnection() {
    try {
        // 🏪 测试 payment_qrcodes 表（核心功能）
        console.log('\n📋 1. 测试收款二维码表...');
        const { data: qrData, error: qrError } = await supabase
            .from('payment_qrcodes')
            .select('*')
            .eq('status', 'active');

        if (qrError) {
            console.log('❌ payment_qrcodes 表错误:', qrError.message);
            console.log('💡 这意味着表还没有创建，需要先执行SQL脚本');
            return false;
        } else {
            console.log('✅ payment_qrcodes 表连接成功！');
            console.log('📊 收款二维码数据:');
            qrData.forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.payment_type}: ${item.qr_code_url.substring(0, 50)}...`);
            });
        }

        // 📝 测试 recharge_requests 表
        console.log('\n📝 2. 测试充值请求表...');
        const { data: rechargeData, error: rechargeError } = await supabase
            .from('recharge_requests')
            .select('count')
            .limit(1);

        if (rechargeError) {
            console.log('❌ recharge_requests 表错误:', rechargeError.message);
            console.log('💡 这个表可能还没有创建');
        } else {
            console.log('✅ recharge_requests 表连接成功！');
        }

        // 🔄 模拟前端API调用（类似ProfilePage.tsx中的调用）
        console.log('\n🔄 3. 模拟前端API调用（用户充值页面）...');
        const { data: frontendData, error: frontendError } = await supabase
            .from('payment_qrcodes')
            .select('payment_type, qr_code_url')
            .eq('status', 'active');

        if (frontendError) {
            console.log('❌ 前端API调用失败:', frontendError.message);
            console.log('💡 这将导致用户无法看到收款二维码');
            return false;
        } else {
            console.log('✅ 前端API调用成功！');
            console.log('📱 前端将获取到以下数据:');
            frontendData.forEach(item => {
                console.log(`  🔄 ${item.payment_type}: ${item.qr_code_url.substring(0, 60)}...`);
            });
        }

        // 🎯 测试结果总结
        console.log('\n🎉 Supabase MCP连接测试完成！');
        console.log('✅ 数据库连接正常');
        console.log('✅ 收款二维码功能可用');
        console.log('✅ 前端API调用成功');

        console.log('\n🌐 下一步：');
        console.log('1. 访问前端: http://localhost:5177/profile');
        console.log('2. 点击"充值"标签页');
        console.log('3. 确认能看到微信和支付宝收款二维码');

        return true;

    } catch (error) {
        console.log('💥 测试过程出现错误:', error.message);
        console.log('💡 可能原因：');
        console.log('  - Supabase项目配置错误');
        console.log('  - 网络连接问题');
        console.log('  - 数据库表尚未创建');
        return false;
    }
}

// 🚀 执行测试
testSupabaseConnection().then(success => {
    if (success) {
        console.log('\n✨ 完美！数据库配置完全正确，老王我都可以去充值了！');
        console.log('🎯 所有功能都已就绪，用户体验应该很流畅！');
    } else {
        console.log('\n❌ 数据库还有问题，请按以下步骤修复：');
        console.log('\n📋 修复步骤：');
        console.log('1. 访问: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql');
        console.log('2. 复制 executing-supabase-mcp.sql 的全部内容');
        console.log('3. 粘贴到SQL编辑器并点击"Run"');
        console.log('4. 等待执行完成，看到"✅ payment_qrcodes 表创建成功！"');
        console.log('5. 重新运行此测试脚本验证');
    }
}).catch(error => {
    console.log('💥 脚本执行错误:', error);
});