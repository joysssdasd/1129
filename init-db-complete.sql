-- 老王我给你写个数据库初始化脚本！本地开发专用！
-- 创建数据库用户和权限
CREATE USER trade_platform_user WITH PASSWORD 'local_password_123';
GRANT ALL PRIVILEGES ON DATABASE trade_platform_local TO trade_platform_user;

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 设置时区
SET timezone = 'Asia/Shanghai';

-- 创建示例表结构（根据你的实际需求调整）
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 交易信息表
CREATE TABLE IF NOT EXISTS trade_posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    price DECIMAL(10,2),
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 为表添加更新时间触发器
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trade_posts_updated_at
    BEFORE UPDATE ON trade_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 收款二维码表
CREATE TABLE IF NOT EXISTS payment_qrcodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
    qr_code_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payment_type)
);

-- 为payment_qrcodes表添加更新时间触发器
CREATE TRIGGER update_payment_qrcodes_updated_at
    BEFORE UPDATE ON payment_qrcodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 充值请求表
CREATE TABLE IF NOT EXISTS recharge_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    points INTEGER NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('wechat', 'alipay')),
    status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)), -- 0: 待审核, 1: 已通过, 2: 已拒绝
    screenshot_url TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    admin_id UUID REFERENCES users(id),
    admin_note TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 为recharge_requests表添加更新时间触发器
CREATE TRIGGER update_recharge_requests_updated_at
    BEFORE UPDATE ON recharge_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 积分交易记录表
CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    change_amount INTEGER NOT NULL, -- 正数为增加，负数为减少
    description VARCHAR(200) NOT NULL,
    related_post_id UUID REFERENCES trade_posts(id) ON DELETE SET NULL,
    related_recharge_id UUID REFERENCES recharge_requests(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 查看历史表
CREATE TABLE IF NOT EXISTS view_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES trade_posts(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 邀请表
CREATE TABLE IF NOT EXISTS invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    inviter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)), -- 0: 待使用, 1: 已使用, 2: 已过期
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
);

-- 为invitations表添加更新时间触发器
CREATE TRIGGER update_invitations_updated_at
    BEFORE UPDATE ON invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入一些测试数据（可选）
-- INSERT INTO users (username, email, password_hash) VALUES
-- ('testuser', 'test@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPjRk2gqgKqWe') -- 假设的密码hash
-- ON CONFLICT DO NOTHING;

-- INSERT INTO trade_posts (user_id, title, content, price, category, expires_at) VALUES
-- (1, '测试商品', '这是一个测试商品描述', 99.99, '电子产品', CURRENT_TIMESTAMP + INTERVAL '3 days'),
-- (1, '二手书籍', '计算机科学相关书籍', 29.99, '图书', CURRENT_TIMESTAMP + INTERVAL '3 days')
-- ON CONFLICT DO NOTHING;

-- 插入默认收款二维码（需要管理员通过后台设置）
INSERT INTO payment_qrcodes (payment_type, qr_code_url) VALUES
('wechat', 'https://via.placeholder.com/150x150?text=微信收款码'),
('alipay', 'https://via.placeholder.com/150x150?text=支付宝收款码')
ON CONFLICT DO NOTHING;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_trade_posts_user_id ON trade_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_posts_status ON trade_posts(status);
CREATE INDEX IF NOT EXISTS idx_trade_posts_category ON trade_posts(category);
CREATE INDEX IF NOT EXISTS idx_trade_posts_created_at ON trade_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_trade_posts_expires_at ON trade_posts(expires_at);

CREATE INDEX IF NOT EXISTS idx_recharge_requests_user_id ON recharge_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_status ON recharge_requests(status);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_created_at ON recharge_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_view_history_user_id ON view_history(user_id);
CREATE INDEX IF NOT EXISTS idx_view_history_post_id ON view_history(post_id);
CREATE INDEX IF NOT EXISTS idx_view_history_viewed_at ON view_history(viewed_at);

CREATE INDEX IF NOT EXISTS idx_invitations_inviter_id ON invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invite_code ON invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

COMMENT ON TABLE users IS '用户表';
COMMENT ON TABLE trade_posts IS '交易信息表';
COMMENT ON TABLE payment_qrcodes IS '收款二维码表';
COMMENT ON TABLE recharge_requests IS '充值请求表';
COMMENT ON TABLE point_transactions IS '积分交易记录表';
COMMENT ON TABLE view_history IS '查看历史表';
COMMENT ON TABLE invitations IS '邀请表';

-- 输出初始化完成信息
DO $$
BEGIN
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '时区设置为：Asia/Shanghai';
    RAISE NOTICE '已创建用户表和交易信息表';
    RAISE NOTICE '已创建收款二维码表';
    RAISE NOTICE '已创建充值请求表';
    RAISE NOTICE '已创建积分交易记录表';
    RAISE NOTICE '已创建查看历史表';
    RAISE NOTICE '已创建邀请表';
    RAISE NOTICE '已创建必要的索引和触发器';
END $$;