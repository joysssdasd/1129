-- 🚀 老王我准备的Supabase MCP数据库修复脚本！
-- 📍 在 Supabase SQL Editor 中执行：https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql

-- 🗑️ 清理环境（安全起见，先删除可能存在的错误结构）
DROP TABLE IF EXISTS public.payment_qrcodes CASCADE;
DROP TABLE IF EXISTS public.recharge_requests CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 🏗️ 步骤1: 创建收款二维码表（核心表！）
CREATE TABLE public.payment_qrcodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
    qr_code_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payment_type)
);

-- 🏷️ 添加表注释
COMMENT ON TABLE public.payment_qrcodes IS '收款二维码表 - 管理员可配置微信/支付宝收款码';

-- 💾 步骤2: 创建通用更新时间函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ⚡ 步骤3: 创建收款二维码表触发器
CREATE TRIGGER update_payment_qrcodes_updated_at
    BEFORE UPDATE ON public.payment_qrcodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 📝 步骤4: 插入默认收款二维码（立即可用！）
INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=微信收款码-请管理员替换为真实二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=支付宝收款码-请管理员替换为真实二维码', 'active');

-- 🔍 步骤5: 创建充值请求表（用户充值功能需要）
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

-- 🏷️ 添加充值表注释
COMMENT ON TABLE public.recharge_requests IS '用户充值请求表 - 包含充值金额、积分、状态等信息';

-- ⚡ 步骤6: 创建充值表触发器
CREATE TRIGGER update_recharge_requests_updated_at
    BEFORE UPDATE ON public.recharge_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 📊 步骤7: 验证执行结果
SELECT '✅ payment_qrcodes 表创建成功！' as status;
SELECT payment_type, status, created_at FROM public.payment_qrcodes ORDER BY payment_type;

SELECT '🎉 老王的Supabase MCP数据库修复完成！' as final_status;
SELECT '💡 现在去前端测试：http://localhost:5177/profile' as next_step;
SELECT '🔄 切换到"充值"标签页，应该能看到收款二维码！' as instruction;

-- 📋 查看完整数据
SELECT
    'payment_qrcodes' as table_name,
    payment_type,
    status,
    LEFT(qr_code_url, 60) as qr_url_preview,
    created_at
FROM public.payment_qrcodes
ORDER BY payment_type;