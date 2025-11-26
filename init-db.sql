-- 老王我给你写个数据库初始化脚本！本地开发专用！

-- 创建数据库用户和权限
-- CREATE USER trade_platform_user WITH PASSWORD 'local_password_123';
-- GRANT ALL PRIVILEGES ON DATABASE trade_platform_local TO trade_platform_user;

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
$$ language 'plpgsql';

-- 为表添加更新时间触发器
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trade_posts_updated_at
    BEFORE UPDATE ON trade_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入一些测试数据（可选）
-- INSERT INTO users (username, email, password_hash) VALUES
-- ('testuser', 'test@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPjRk2gqgKqWe') -- 假设的密码hash
-- ON CONFLICT DO NOTHING;

-- INSERT INTO trade_posts (user_id, title, content, price, category, expires_at) VALUES
-- (1, '测试商品', '这是一个测试商品描述', 99.99, '电子产品', CURRENT_TIMESTAMP + INTERVAL '3 days'),
-- (1, '二手书籍', '计算机科学相关书籍', 29.99, '图书', CURRENT_TIMESTAMP + INTERVAL '3 days')
-- ON CONFLICT DO NOTHING;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_trade_posts_user_id ON trade_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_posts_status ON trade_posts(status);
CREATE INDEX IF NOT EXISTS idx_trade_posts_category ON trade_posts(category);
CREATE INDEX IF NOT EXISTS idx_trade_posts_created_at ON trade_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_trade_posts_expires_at ON trade_posts(expires_at);

COMMENT ON TABLE users IS '用户表';
COMMENT ON TABLE trade_posts IS '交易信息表';
COMMENT ON COLUMN trade_posts.status IS '状态：active, expired, sold, deleted';
COMMENT ON COLUMN trade_posts.category IS '分类：电子产品, 图书, 服装, 家居等';

-- 输出初始化完成信息
DO $$
BEGIN
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '时区设置为：Asia/Shanghai';
    RAISE NOTICE '已创建用户表和交易信息表';
    RAISE NOTICE '已创建必要的索引和触发器';
END $$;