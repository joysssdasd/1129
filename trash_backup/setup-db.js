// 老王我给你写个数据库设置脚本！
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 缺少Supabase环境变量！');
    console.log('请在.env文件中设置：');
    console.log('VITE_SUPABASE_URL=your_supabase_url');
    console.log('VITE_SUPABASE_ANON_KEY=your_supabase_anon_key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
    console.log('🔧 老王正在设置数据库...');

    try {
        // 1. 尝试查询payment_qrcodes表，如果不存在就创建
        console.log('📱 检查payment_qrcodes表...');

        const { data, error } = await supabase
            .from('payment_qrcodes')
            .select('*')
            .limit(1);

        if (error && error.message.includes('does not exist')) {
            console.log('⚠️ payment_qrcodes表不存在，请在Supabase Dashboard执行以下SQL：');
            console.log(`
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

-- 插入默认收款二维码（临时用的，之后管理员可以替换）
INSERT INTO payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
ON CONFLICT DO NOTHING;

-- 创建充值请求表
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

-- 创建积分交易记录表
CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    change_amount INTEGER NOT NULL,
    description VARCHAR(200) NOT NULL,
    related_post_id UUID REFERENCES trade_posts(id) ON DELETE SET NULL,
    related_recharge_id UUID REFERENCES recharge_requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 创建查看历史表
CREATE TABLE IF NOT EXISTS view_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES trade_posts(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 创建邀请表
CREATE TABLE IF NOT EXISTS invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    inviter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
);

-- 查看history表是否存在，如果不存在就创建
SELECT 'invitations' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'invitations';

DO $$
BEGIN
    -- 为invitations表添加更新时间触发器
    CREATE TRIGGER IF NOT EXISTS update_invitations_updated_at
        BEFORE UPDATE ON invitations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- 为所有表添加注释
COMMENT ON TABLE payment_qrcodes IS '收款二维码表';
COMMENT ON TABLE recharge_requests IS '充值请求表';
COMMENT ON TABLE point_transactions IS '积分交易记录表';
COMMENT ON TABLE view_history IS '查看历史表';
COMMENT ON TABLE invitations IS '邀请表';
            `);

            console.log('🎯 执行完成后，用户就能看到充值二维码了！');

        } else {
            console.log('✅ payment_qrcodes表已存在');

            // 检查是否有数据
            if (data && data.length > 0) {
                console.log('✅ 表中已有数据，用户应该能看到二维码');
            } else {
                console.log('⚠️ 表存在但没有数据，请管理员在后台上传收款二维码');
            }
        }

    } catch (error) {
        console.error('❌ 设置数据库失败:', error);
        console.log('💡 如果是表不存在，请手动在Supabase Dashboard SQL Editor中执行上面的SQL语句');
    }
}

setupDatabase();