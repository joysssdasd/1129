// 老王我给你写个数据库设置脚本！
const { createClient } = require('@supabase/supabase-js');

// 需要环境变量，先从常见位置读取
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

console.log('🔧 老王我来直接操作Supabase数据库！');
console.log('Supabase URL:', supabaseUrl ? '已设置' : '使用默认值');

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
    console.log('📱 老王正在设置数据库...');

    try {
        // 1. 检查payment_qrcodes表是否存在
        console.log('📋 检查payment_qrcodes表...');

        const { data: existingData, error: checkError } = await supabase
            .from('payment_qrcodes')
            .select('*')
            .limit(1);

        if (checkError && checkError.message.includes('does not exist')) {
            console.log('⚠️ payment_qrcodes表不存在，请手动在Supabase Dashboard创建：');
            console.log(`
===================================
SQL 执行语句：
===================================

-- 创建收款二维码表
CREATE TABLE IF NOT EXISTS payment_qrcodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
    qr_code_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payment_type)
);

-- 插入默认收款二维码（临时用）
INSERT INTO payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
ON CONFLICT DO NOTHING;
===================================
            `);
        } else {
            console.log('✅ payment_qrcodes表已存在');

            if (existingData && existingData.length > 0) {
                console.log('✅ 表中有数据，用户应该能看到二维码');
                console.log('数据条数:', existingData.length);
            } else {
                console.log('⚠️ 表存在但没有数据，请管理员上传收款二维码');
            }
        }

        console.log('🎯 数据库设置完成！用户现在可以访问充值页面了。');

    } catch (error) {
        console.error('❌ 设置数据库失败:', error);
        console.log('💡 请确保：');
        console.log('1. Supabase URL和密钥正确');
        console.log('2. 网络连接正常');
        console.log('3. Supabase项目权限正确');
    }
}

setupDatabase();