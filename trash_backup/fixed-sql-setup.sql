-- 老王我修复SQL执行顺序问题！
-- 在Supabase SQL Editor中执行，按依赖关系分步创建

-- 步骤1: 删除可能存在的错误函数（清理环境）
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_payment_qrcodes_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_recharge_requests_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_invitations_updated_at_column() CASCADE;

-- 步骤2: 创建基础表（无外键依赖）
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

-- 步骤3: 创建通用更新函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 步骤4: 创建 payment_qrcodes 触发器
DROP TRIGGER IF EXISTS update_payment_qrcodes_updated_at ON public.payment_qrcodes;
CREATE TRIGGER update_payment_qrcodes_updated_at
    BEFORE UPDATE ON public.payment_qrcodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 步骤5: 创建 recharge_requests 表（依赖auth.users）
CREATE TABLE IF NOT EXISTS public.recharge_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    points INTEGER NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('wechat', 'alipay')),
    status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)),
    screenshot_url TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    admin_id UUID REFERENCES auth.users(id),
    admin_note TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.recharge_requests IS '充值请求表';

-- 步骤6: 创建 recharge_requests 触发器
DROP TRIGGER IF EXISTS update_recharge_requests_updated_at ON public.recharge_requests;
CREATE TRIGGER update_recharge_requests_updated_at
    BEFORE UPDATE ON public.recharge_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 步骤7: 创建 point_transactions 表（依赖auth.users, trade_posts, recharge_requests）
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

-- 步骤8: 创建 view_history 表（依赖auth.users, trade_posts）
CREATE TABLE IF NOT EXISTS public.view_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.trade_posts(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.view_history IS '查看历史表';

-- 步骤9: 创建 invitations 表（依赖auth.users）
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
);

COMMENT ON TABLE public.invitations IS '邀请表';

-- 步骤10: 创建 invitations 触发器
DROP TRIGGER IF EXISTS update_invitations_updated_at ON public.invitations;
CREATE TRIGGER update_invitations_updated_at
    BEFORE UPDATE ON public.invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 步骤11: 创建性能索引（所有表创建完成后）
CREATE INDEX IF NOT EXISTS idx_recharge_requests_user_id ON public.recharge_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_status ON public.recharge_requests(status);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_created_at ON public.recharge_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON public.point_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_view_history_user_id ON public.view_history(user_id);
CREATE INDEX IF NOT EXISTS idx_view_history_post_id ON public.view_history(post_id);
CREATE INDEX IF NOT EXISTS idx_view_history_viewed_at ON public.view_history(viewed_at);
CREATE INDEX IF NOT EXISTS idx_invitations_inviter_id ON public.invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_id ON public.invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invite_code ON public.invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON public.invitations(expires_at);

-- 步骤12: 插入默认收款二维码
INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
ON CONFLICT (payment_type) DO NOTHING;

-- 步骤13: 验证结果
SELECT '✅ payment_qrcodes 表创建成功！' as status;
SELECT payment_type, status, created_at FROM public.payment_qrcodes;

SELECT '🎉 老王的数据库设置完成！所有表都已创建！' as final_status;
SELECT '🏪 用户现在可以在充值页面看到收款二维码了！' as next_step;
SELECT '🌐 前端访问地址: http://localhost:5173/profile' as access_url;