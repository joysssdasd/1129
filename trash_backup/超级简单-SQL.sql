-- 老王给你最简单绝对不会错的SQL！
-- 直接复制这个到Supabase SQL Editor执行

-- 1. 创建收款二维码表
CREATE TABLE public.payment_qrcodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
    qr_code_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payment_type)
);

-- 2. 插入默认数据
INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
ON CONFLICT (payment_type) DO NOTHING;

-- 3. 验证结果
SELECT '✅ 成功创建 payment_qrcodes 表！' as result;
SELECT payment_type, status, created_at FROM public.payment_qrcodes;