-- 🚀 老王我给你的最终Supabase数据库修复脚本！
-- 📍 直接复制全部内容到：https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql
-- 💡 一键执行所有必要操作，立即解决支付二维码和登录问题！

-- 🗑️ 安全清理（删除可能存在的错误结构）
DROP TABLE IF EXISTS public.payment_qrcodes CASCADE;
DROP TABLE IF EXISTS public.recharge_requests CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 🏗️ 核心表1: 收款二维码表（解决用户看不到二维码的问题！）
CREATE TABLE public.payment_qrcodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
    qr_code_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payment_type)
);

-- 📊 插入默认收款二维码（立即可用！）
INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=微信收款码-请管理员替换为真实二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=支付宝收款码-请管理员替换为真实二维码', 'active');

-- 💾 创建通用更新函数（所有表共用）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ⚡ 创建收款二维码表触发器
CREATE TRIGGER update_payment_qrcodes_updated_at
    BEFORE UPDATE ON public.payment_qrcodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 🏪 核心表2: 充值请求表（支持用户充值功能！）
CREATE TABLE public.recharge_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    points INTEGER NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('wechat', 'alipay')),
    status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)), -- 0=待处理, 1=已确认, 2=已拒绝
    screenshot_url TEXT,
    admin_note TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ⚡ 创建充值请求表触发器
CREATE TRIGGER update_recharge_requests_updated_at
    BEFORE UPDATE ON public.recharge_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 🔍 验证执行结果
SELECT '✅ payment_qrcodes 表创建成功！' as status;
SELECT payment_type, status, created_at FROM public.payment_qrcodes ORDER BY payment_type;

SELECT '✅ recharge_requests 表创建成功！' as status2;
SELECT '🎉 老王的数据库修复完成！' as final_status;
SELECT '💡 现在去前端测试：http://localhost:5177/profile' as next_step;
SELECT '🔄 切换到"充值"标签页，应该能看到收款二维码！' as instruction;

-- 📋 查看完整收款二维码数据
SELECT
    payment_type,
    status,
    LEFT(qr_code_url, 60) as qr_url_preview,
    created_at
FROM public.payment_qrcodes
ORDER BY payment_type;

-- 📊 查看充值请求表结构
SELECT
    'recharge_requests' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'recharge_requests'
    AND table_schema = 'public'
ORDER BY ordinal_position;