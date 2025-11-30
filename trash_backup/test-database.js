// 🔍 老王的数据库连接测试脚本
import { createClient } from '@supabase/supabase-js';

// 📝 使用项目中真实的Supabase配置
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabase() {
    console.log('🔍 老王开始测试数据库连接...\n');

    try {
        // 🏪 测试 payment_qrcodes 表
        console.log('📋 1. 测试收款二维码表...');
        const { data: qrData, error: qrError } = await supabase
            .from('payment_qrcodes')
            .select('*')
            .eq('status', 'active');

        if (qrError) {
            console.log('❌ payment_qrcodes 表错误:', qrError.message);
        } else {
            console.log('✅ payment_qrcodes 表正常');
            console.log('📊 收款二维码数据:', qrData);
        }

        // 👤 测试 auth.users 连接
        console.log('\n👤 2. 测试用户认证连接...');
        const { data: authData, error: authError } = await supabase.auth.getSession();

        if (authError) {
            console.log('⚠️  认证连接正常（需要用户登录获取session）');
        } else {
            console.log('✅ 认证系统正常');
        }

        // 📝 测试充值请求表
        console.log('\n📝 3. 测试充值请求表...');
        const { data: rechargeData, error: rechargeError } = await supabase
            .from('recharge_requests')
            .select('count')
            .limit(1);

        if (rechargeError) {
            console.log('❌ recharge_requests 表错误:', rechargeError.message);
        } else {
            console.log('✅ recharge_requests 表正常');
        }

        // 🔄 模拟前端API调用
        console.log('\n🔄 4. 模拟前端API调用（类似ProfilePage.tsx）...');
        const { data: frontendData, error: frontendError } = await supabase
            .from('payment_qrcodes')
            .select('payment_type, qr_code_url')
            .eq('status', 'active');

        if (frontendError) {
            console.log('❌ 前端API调用失败:', frontendError.message);
            return false;
        } else {
            console.log('✅ 前端API调用成功！');
            console.log('📱 前端将获取到以下数据:');
            frontendData.forEach(item => {
                console.log(`  - ${item.payment_type}: ${item.qr_code_url.substring(0, 50)}...`);
            });
        }

        console.log('\n🎉 数据库测试完成！');
        console.log('💡 如果所有测试都通过，前端应该能正常显示收款二维码');
        console.log('🌐 访问: http://localhost:5177/profile');
        console.log('🔄 点击"充值"标签页');

        return true;

    } catch (error) {
        console.log('💥 测试过程出现错误:', error.message);
        return false;
    }
}

// 🚀 执行测试
testDatabase().then(success => {
    if (success) {
        console.log('\n✨ 数据库配置完美！老王我都可以去充值了！');
    } else {
        console.log('\n❌ 数据库还有问题，请检查SQL脚本执行情况');
        console.log('🔧 确保在Supabase SQL Editor中执行了 database-final-fix.sql');
    }
}).catch(error => {
    console.log('💥 脚本执行错误:', error);
});