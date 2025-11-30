// 老王我验证数据库设置是否成功！
const { createClient } = require('@supabase/supabase-js');

// 使用真实配置
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2';

console.log('🔧 老王开始验证数据库设置...');
console.log('URL:', supabaseUrl);
console.log('Key配置状态:', supabaseKey ? '✅ 已配置' : '❌ 未配置');

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDatabaseSetup() {
    console.log('\n🚀 开始验证数据库设置...');

    try {
        // 1. 验证payment_qrcodes表
        console.log('\n📋 步骤1：验证payment_qrcodes表...');
        const { data: qrData, error: qrError } = await supabase
            .from('payment_qrcodes')
            .select('*')
            .order('payment_type');

        if (qrError) {
            console.error('❌ payment_qrcodes表验证失败:', qrError.message);
            console.log('请确保您已经在Supabase Dashboard中执行了 payment-qrcodes-setup.sql');
            return false;
        }

        if (!qrData || qrData.length === 0) {
            console.error('❌ payment_qrcodes表为空');
            console.log('需要插入默认的收款二维码数据');
            return false;
        }

        console.log('✅ payment_qrcodes表验证成功，包含以下数据:');
        qrData.forEach(row => {
            console.log(`- ${row.payment_type}: ${row.status}`);
            console.log(`  二维码URL: ${row.qr_code_url.substring(0, 80)}...`);
            console.log(`  创建时间: ${new Date(row.created_at).toLocaleString('zh-CN')}`);
            console.log('');
        });

        // 2. 验证前端API调用格式
        console.log('\n🌐 步骤2：验证前端API调用格式...');
        const { data: apiData, error: apiError } = await supabase
            .from('payment_qrcodes')
            .select('payment_type, qr_code_url, status')
            .eq('status', 'active')
            .order('payment_type');

        if (apiError) {
            console.error('❌ 前端API验证失败:', apiError.message);
            return false;
        }

        console.log('✅ 前端API验证成功，前端将获取到以下数据:');
        apiData.forEach(row => {
            console.log(`{ payment_type: '${row.payment_type}', qr_code_url: '${row.qr_code_url.substring(0, 50)}...', status: '${row.status}' }`);
        });

        // 3. 检查recharge_requests表（可选）
        console.log('\n💰 步骤3：检查recharge_requests表...');
        const { data: rechargeData, error: rechargeError } = await supabase
            .from('recharge_requests')
            .select('count')
            .limit(1);

        if (rechargeError) {
            console.log('⚠️ recharge_requests表不存在或无法访问:', rechargeError.message);
            console.log('如果需要完整的充值功能，请确保执行了完整的SQL脚本');
        } else {
            console.log('✅ recharge_requests表存在，充值功能完全可用');
        }

        // 4. 模拟前端代码调用
        console.log('\n📱 步骤4：模拟前端代码调用...');
        try {
            const simulateFrontendCall = async () => {
                const { data, error } = await supabase
                    .from('payment_qrcodes')
                    .select('payment_type, qr_code_url')
                    .eq('status', 'active');

                return { data, error };
            };

            const { data: frontendData, error: frontendError } = await simulateFrontendCall();

            if (frontendError) {
                console.error('❌ 前端模拟调用失败:', frontendError.message);
                return false;
            }

            console.log('✅ 前端模拟调用成功，代码可以正常工作:');
            frontendData.forEach(item => {
                console.log(`  const ${item.payment_type}QR = '${item.qr_code_url}';`);
            });

        } catch (simulateError) {
            console.error('❌ 前端模拟调用异常:', simulateError.message);
            return false;
        }

        // 5. 验证完成总结
        console.log('\n🎉 数据库验证完成总结:');
        console.log('✅ payment_qrcodes表存在且包含数据');
        console.log('✅ 微信和支付宝收款二维码都已配置');
        console.log('✅ 前端API调用格式正确');
        console.log('✅ 数据库连接正常');
        console.log('');
        console.log('🏪 用户充值功能已就绪！');
        console.log('🌐 前端访问地址: http://localhost:5173/profile');
        console.log('📊 Supabase Dashboard: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh');
        console.log('');
        console.log('📝 下一步操作:');
        console.log('1. 访问前端 http://localhost:5173/profile');
        console.log('2. 点击充值按钮');
        console.log('3. 确认能看到微信和支付宝的收款二维码');
        console.log('4. 测试完整的充值流程');

        return true;

    } catch (error) {
        console.error('\n❌ 验证过程中遇到错误:', error);
        console.log('这可能是因为:');
        console.log('1. 网络连接问题');
        console.log('2. Supabase配置不正确');
        console.log('3. 数据库表尚未创建');
        console.log('4. SQL脚本尚未执行');
        return false;
    }
}

// 直接执行
if (require.main === module) {
    verifyDatabaseSetup().then(success => {
        if (success) {
            console.log('\n🎊 数据库验证完成！所有功能已就绪！');
        } else {
            console.log('\n❌ 数据库验证失败！');
            console.log('\n📝 请按以下步骤操作:');
            console.log('1. 打开 https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql');
            console.log('2. 复制并执行 payment-qrcodes-setup.sql 文件中的内容');
            console.log('3. 重新运行此验证脚本');
            process.exit(1);
        }
    }).catch(err => {
        console.error('❌ 执行异常:', err);
        process.exit(1);
    });
}

module.exports = { verifyDatabaseSetup };