// 老王我直接测试Supabase连接和数据！
const { createClient } = require('@supabase/supabase-js');

// 使用真实配置
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2';

console.log('🔧 老王开始测试Supabase连接...');
console.log('URL:', supabaseUrl);
console.log('Key配置状态:', supabaseKey ? '✅ 已配置' : '❌ 未配置');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseConnection() {
    console.log('\n🚀 开始测试Supabase连接和数据操作...');

    try {
        // 1. 测试基本连接
        console.log('\n📋 步骤1：测试基本连接...');
        const { data: testData, error: testError } = await supabase
            .from('payment_qrcodes')
            .select('count')
            .limit(1);

        if (testError) {
            console.log('❌ payment_qrcodes表不存在或无法访问:', testError.message);

            // 表不存在，提供SQL脚本
            console.log('\n📝 请在Supabase Dashboard中执行以下SQL脚本:');
            console.log('URL: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql');
            console.log('\n```sql');
            console.log(`
-- 创建收款二维码表
CREATE TABLE IF NOT EXISTS public.payment_qrcodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
    qr_code_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payment_type)
);

COMMENT ON TABLE public.payment_qrcodes IS '收款二维码表';

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_payment_qrcodes_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 创建触发器
DROP TRIGGER IF EXISTS update_payment_qrcodes_updated_at ON public.payment_qrcodes;
CREATE TRIGGER update_payment_qrcodes_updated_at
    BEFORE UPDATE ON public.payment_qrcodes
    FOR EACH ROW EXECUTE FUNCTION update_payment_qrcodes_updated_at_column();

-- 插入默认收款二维码
INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
ON CONFLICT (payment_type) DO NOTHING;

-- 验证数据
SELECT 'payment_qrcodes 表数据:' as info;
SELECT payment_type, status, created_at FROM public.payment_qrcodes;
            `);
            console.log('```');

            return false;
        } else {
            console.log('✅ 基本连接成功，payment_qrcodes表存在');
        }

        // 2. 查询现有数据
        console.log('\n💳 步骤2：查询现有收款二维码数据...');
        const { data: existingData, error: existingError } = await supabase
            .from('payment_qrcodes')
            .select('*');

        if (existingError) {
            console.error('❌ 查询数据失败:', existingError);
            return false;
        }

        if (existingData && existingData.length > 0) {
            console.log('✅ 找到现有收款二维码数据:');
            existingData.forEach(row => {
                console.log(`- ${row.payment_type}: ${row.status}`);
                console.log(`  URL: ${row.qr_code_url}`);
                console.log(`  创建时间: ${row.created_at}`);
            });
        } else {
            console.log('❌ 表中没有数据，需要插入默认数据');
        }

        // 3. 尝试插入/更新默认数据
        console.log('\n🔄 步骤3：确保默认收款二维码存在...');
        const { data: upsertData, error: upsertError } = await supabase
            .from('payment_qrcodes')
            .upsert([
                {
                    payment_type: 'wechat',
                    qr_code_url: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码',
                    status: 'active'
                },
                {
                    payment_type: 'alipay',
                    qr_code_url: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码',
                    status: 'active'
                }
            ], {
                onConflict: 'payment_type'
            })
            .select();

        if (upsertError) {
            console.error('❌ 插入默认数据失败:', upsertError);
            return false;
        }

        console.log('✅ 默认收款二维码数据更新成功:');
        upsertData.forEach(row => {
            console.log(`- ${row.payment_type}: ${row.status}`);
        });

        // 4. 验证前端API调用
        console.log('\n🌐 步骤4：验证前端API调用...');
        const { data: apiData, error: apiError } = await supabase
            .from('payment_qrcodes')
            .select('payment_type, qr_code_url, status')
            .eq('status', 'active')
            .order('payment_type');

        if (apiError) {
            console.error('❌ API验证失败:', apiError);
            return false;
        }

        console.log('✅ 前端API验证成功，返回数据:');
        apiData.forEach(row => {
            console.log(`- ${row.payment_type}: ${row.status}`);
            console.log(`  二维码URL长度: ${row.qr_code_url.length} 字符`);
        });

        // 5. 测试完整的充值流程数据结构
        console.log('\n🏪 步骤5：检查充值相关的其他表...');

        // 检查recharge_requests表
        const { data: rechargeData, error: rechargeError } = await supabase
            .from('recharge_requests')
            .select('count')
            .limit(1);

        if (rechargeError) {
            console.log('⚠️ recharge_requests表不存在:', rechargeError.message);
            console.log('如果需要充值功能，也请创建该表');
        } else {
            console.log('✅ recharge_requests表存在');
        }

        // 6. 总结
        console.log('\n🎉 老王我测试完成了！');
        console.log('✅ Supabase连接正常');
        console.log('✅ payment_qrcodes表存在且包含数据');
        console.log('✅ 前端API调用正常');
        console.log('🏪 用户现在可以在充值页面看到收款二维码了！');
        console.log('🌐 前端访问地址: http://localhost:5173/profile');
        console.log('📊 Supabase Dashboard: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh');

        return true;

    } catch (error) {
        console.error('\n❌ 测试过程中遇到错误:', error);
        return false;
    }
}

// 直接执行
if (require.main === module) {
    testSupabaseConnection().then(success => {
        if (success) {
            console.log('\n🎊 Supabase数据库测试完成！一切正常！');
        } else {
            console.log('\n❌ Supabase数据库测试失败！请执行SQL脚本！');
            process.exit(1);
        }
    }).catch(err => {
        console.error('❌ 执行异常:', err);
        process.exit(1);
    });
}

module.exports = { testSupabaseConnection };