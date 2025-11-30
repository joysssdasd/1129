-- =====================================================
-- 简化的 Supabase 数据库设置脚本
-- 专注于创建必要的表和插入默认数据
-- 在 Supabase Dashboard SQL 编辑器中执行
-- URL: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql
-- =====================================================

-- 1. 创建收款二维码表
CREATE TABLE IF NOT EXISTS public.payment_qrcodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
    qr_code_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payment_type)
);

-- 2. 插入默认收款二维码数据
INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
ON CONFLICT (payment_type) DO NOTHING;

-- 3. 创建充值请求表
CREATE TABLE IF NOT EXISTS public.recharge_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    points INTEGER NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('wechat', 'alipay')),
    status INTEGER DEFAULT 0, -- 0: pending, 1: approved, 2: rejected
    screenshot_url TEXT,
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. 创建积分交易记录表
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    change_amount INTEGER NOT NULL,
    description VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. 验证数据插入
SELECT '=== payment_qrcodes 表数据验证 ===' as info;
SELECT
    payment_type,
    status,
    qr_code_url,
    created_at
FROM public.payment_qrcodes
ORDER BY payment_type;

-- 6. 完成确认
SELECT
    '✅ 数据库设置完成！' as status,
    '🏪 收款二维码表已创建并插入默认数据' as result,
    '💰 充值请求表已创建' as recharge_table,
    '📊 积分交易记录表已创建' as transaction_table;