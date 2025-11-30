-- =====================================================
-- 完整的Supabase数据库设置脚本
-- 在Supabase Dashboard的SQL编辑器中执行此脚本
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

-- 添加表注释
COMMENT ON TABLE public.payment_qrcodes IS '收款二维码表';

-- 2. 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_payment_qrcodes_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 3. 创建触发器
DROP TRIGGER IF EXISTS update_payment_qrcodes_updated_at ON public.payment_qrcodes;
CREATE TRIGGER update_payment_qrcodes_updated_at
    BEFORE UPDATE ON public.payment_qrcodes
    FOR EACH ROW EXECUTE FUNCTION update_payment_qrcodes_updated_at_column();

-- 4. 插入默认收款二维码
INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
ON CONFLICT (payment_type) DO NOTHING;

-- 5. 创建充值请求表（如果需要充值功能）
CREATE TABLE IF NOT EXISTS public.recharge_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    points INTEGER NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('wechat', 'alipay')),
    status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)), -- 0: pending, 1: approved, 2: rejected
    screenshot_url TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    admin_id UUID REFERENCES auth.users(id),
    admin_note TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.recharge_requests IS '充值请求表';

-- 6. 创建充值请求表的更新触发器
CREATE OR REPLACE FUNCTION update_recharge_requests_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_recharge_requests_updated_at ON public.recharge_requests;
CREATE TRIGGER update_recharge_requests_updated_at
    BEFORE UPDATE ON public.recharge_requests
    FOR EACH ROW EXECUTE FUNCTION update_recharge_requests_updated_at_column();

-- 7. 创建积分交易记录表
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    change_amount INTEGER NOT NULL,
    description VARCHAR(200) NOT NULL,
    related_post_id UUID REFERENCES public.trade_posts(id) ON DELETE SET NULL,
    related_recharge_id UUID REFERENCES public.recharge_requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.point_transactions IS '积分交易记录表';

-- 8. 创建性能优化索引
CREATE INDEX IF NOT EXISTS idx_payment_qrcodes_payment_type ON public.payment_qrcodes(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_qrcodes_status ON public.payment_qrcodes(status);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_user_id ON public.recharge_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_status ON public.recharge_requests(status);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_created_at ON public.recharge_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON public.point_transactions(created_at);

-- 9. 验证数据插入
SELECT '=== payment_qrcodes 表数据验证 ===' as info;
SELECT
    payment_type,
    status,
    LEFT(qr_code_url, 50) || '...' as qr_code_url_preview,
    created_at,
    updated_at
FROM public.payment_qrcodes
ORDER BY payment_type;

-- 10. 验证表结构
SELECT '=== 表结构验证 ===' as info;
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('payment_qrcodes', 'recharge_requests', 'point_transactions')
ORDER BY table_name, ordinal_position;

-- 11. 完成状态报告
SELECT
    '🎉 数据库设置完成！' as status,
    '🏪 用户现在可以在充值页面看到收款二维码了！' as feature,
    '🌐 前端访问地址: http://localhost:5173/profile' as frontend_url,
    '📊 Dashboard: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh' as dashboard_url;