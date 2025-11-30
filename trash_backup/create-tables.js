// 老王我给你写个直接创建数据库表的脚本！
// 需要在Supabase SQL Editor中执行

const { createClient } = require('@supabase/supabase-js');

// 需要环境变量，这里先使用占位符
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createPaymentTables() {
    console.log('🔧 老王正在创建数据库表...');

    try {
        // 1. 创建 payment_qrcodes 表
        console.log('📱 创建收款二维码表...');
        const { error: qrError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
                    CREATE TABLE IF NOT EXISTS payment_qrcodes (
                        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                        payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
                        qr_code_url TEXT NOT NULL,
                        status VARCHAR(20) DEFAULT 'active',
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(payment_type)
                    );

                    COMMENT ON TABLE payment_qrcodes IS '收款二维码表';
                `
            }
        });

        if (qrError) {
            console.error('❌ 创建payment_qrcodes表失败:', qrError);
        } else {
            console.log('✅ payment_qrcodes表创建成功');
        }

        // 2. 创建 recharge_requests 表
        console.log('💰 创建充值请求表...');
        const { error: rechargeError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
                    CREATE TABLE IF NOT EXISTS recharge_requests (
                        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                        amount DECIMAL(10,2) NOT NULL,
                        points INTEGER NOT NULL,
                        payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('wechat', 'alipay')),
                        status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)),
                        screenshot_url TEXT,
                        is_custom BOOLEAN DEFAULT FALSE,
                        admin_id UUID REFERENCES users(id),
                        admin_note TEXT,
                        processed_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );

                    COMMENT ON TABLE recharge_requests IS '充值请求表';
                `
            }
        });

        if (rechargeError) {
            console.error('❌ 创建recharge_requests表失败:', rechargeError);
        } else {
            console.log('✅ recharge_requests表创建成功');
        }

        // 3. 插入默认收款二维码
        console.log('🏪 插入默认收款二维码...');
        const { error: insertError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
                    INSERT INTO payment_qrcodes (payment_type, qr_code_url) VALUES
                    ('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码'),
                    ('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码')
                    ON CONFLICT DO NOTHING;
                `
            }
        });

        if (insertError) {
            console.error('❌ 插入默认二维码失败:', insertError);
        } else {
            console.log('✅ 默认收款二维码插入成功');
        }

        console.log('🎉 数据库表创建完成！用户现在可以看到充值二维码了！');

    } catch (error) {
        console.error('❌ 执行数据库操作失败:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    createPaymentTables();
}

module.exports = { createPaymentTables };