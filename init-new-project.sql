-- ========================================
-- 新项目数据库初始化脚本
-- ========================================

-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    wechat_id VARCHAR(100),
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    invited_by VARCHAR(20),
    points INTEGER DEFAULT 100,
    total_posts INTEGER DEFAULT 0,
    total_invites INTEGER DEFAULT 0,
    register_ip VARCHAR(50),
    last_login_ip VARCHAR(50),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建交易信息表
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    keywords VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    trade_type INTEGER NOT NULL, -- 1=买入 2=卖出 3=做多 4=做空
    delivery_days INTEGER, -- 交割天数（做多/做空时必填）
    extra_info TEXT,
    view_limit INTEGER DEFAULT 10,
    view_count INTEGER DEFAULT 0,
    deal_count INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1, -- 0=下架 1=上架
    expire_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建查看历史表
CREATE TABLE IF NOT EXISTS view_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    is_deal_confirmed BOOLEAN,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- 4. 创建积分交易记录表
CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_type INTEGER NOT NULL, -- 0=注册 1=充值 2=发布 3=查看 4=奖励 5=下架返还 6=重新上架
    change_amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    related_id UUID,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 创建充值申请表
CREATE TABLE IF NOT EXISTS recharge_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    points INTEGER NOT NULL,
    screenshot_url TEXT NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'alipay',
    status INTEGER DEFAULT 0, -- 0=待审核 1=已通过 2=已拒绝
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 6. 创建收款二维码表
CREATE TABLE IF NOT EXISTS payment_qrcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_type VARCHAR(20) NOT NULL, -- wechat, alipay
    qr_code_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 创建邀请记录表
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_code VARCHAR(20) NOT NULL,
    invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    has_posted BOOLEAN DEFAULT FALSE,
    reward_sent BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(inviter_code, invitee_id)
);

-- 8. 创建索引
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_view_history_user_id ON view_history(user_id);
CREATE INDEX IF NOT EXISTS idx_view_history_post_id ON view_history(post_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_user_id ON recharge_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_status ON recharge_requests(status);

-- 9. 启用 RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recharge_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_qrcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- 10. 创建 RLS 策略 - 允许所有读取（通过 Edge Functions 控制权限）
CREATE POLICY "Allow read access to users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow read access to posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Allow read access to view_history" ON view_history FOR SELECT USING (true);
CREATE POLICY "Allow read access to point_transactions" ON point_transactions FOR SELECT USING (true);
CREATE POLICY "Allow read access to recharge_requests" ON recharge_requests FOR SELECT USING (true);
CREATE POLICY "Allow read access to payment_qrcodes" ON payment_qrcodes FOR SELECT USING (status = 'active');
CREATE POLICY "Allow read access to invitations" ON invitations FOR SELECT USING (true);

-- 11. 插入测试收款二维码数据（请替换为实际的二维码 URL）
INSERT INTO payment_qrcodes (payment_type, qr_code_url, status) 
VALUES 
    ('wechat', 'https://hntiihuxqlklpiyqmlob.supabase.co/storage/v1/object/public/payment-qrcodes/wechat-qr.jpg', 'active'),
    ('alipay', 'https://hntiihuxqlklpiyqmlob.supabase.co/storage/v1/object/public/payment-qrcodes/alipay-qr.jpg', 'active')
ON CONFLICT DO NOTHING;

-- 完成
SELECT 'Database initialization completed!' as message;
