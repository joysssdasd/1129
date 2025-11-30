-- =====================================================
-- Supabase 数据库完整设置脚本
-- 请在 Supabase SQL 编辑器中执行此脚本
-- =====================================================

-- 1. 创建 payment_qrcodes 表（收款二维码表）
CREATE TABLE IF NOT EXISTS payment_qrcodes (
  id SERIAL PRIMARY KEY,
  payment_type VARCHAR(50) NOT NULL UNIQUE,
  qr_code_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_payment_qrcodes_type ON payment_qrcodes(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_qrcodes_active ON payment_qrcodes(is_active);

-- 2. 插入默认收款二维码数据
INSERT INTO payment_qrcodes (payment_type, qr_code_url, description, is_active) VALUES
('微信', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJibGFjayI+5Li76aKY5pS/5Yqh5bmz5piM5pys6LSo77yM5pyA5aSa5L2T6Lev55S15Z2A5pS/5Yqh6ZyA5YWz5Y+K77yB5L2g5aW977yB5Li65LuA5LmQ6KGo77yM6aG555uu77yBPC90ZXh0Pgo8L3N2Zz4=', '微信收款二维码 - 请使用微信扫描进行充值', true),
('支付宝', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJibGFjayI+5p+Q5r2t5piM5pys6LSo77yM5pyA5aSa5L2T6Lev55S15Z2A5p+Q5r2t6ZyA5YWz5Y+K77yB5L2g5aW977yB5Li65LuA5LmQ6KGo77yM6aG555uu77yBPC90ZXh0Pgo8L3N2Zz4=', '支付宝收款二维码 - 请使用支付宝扫描进行充值', true)
ON CONFLICT (payment_type) DO UPDATE SET
  qr_code_url = EXCLUDED.qr_code_url,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 3. 创建 recharge_requests 表（充值请求表）
CREATE TABLE IF NOT EXISTS recharge_requests (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_type VARCHAR(50) NOT NULL,
  payment_proof TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  remark TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_recharge_requests_user_id ON recharge_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_status ON recharge_requests(status);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_created_at ON recharge_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_payment_type ON recharge_requests(payment_type);

-- 4. 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. 为 payment_qrcodes 表创建触发器
DROP TRIGGER IF EXISTS update_payment_qrcodes_updated_at ON payment_qrcodes;
CREATE TRIGGER update_payment_qrcodes_updated_at
    BEFORE UPDATE ON payment_qrcodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. 为 recharge_requests 表创建触发器
DROP TRIGGER IF EXISTS update_recharge_requests_updated_at ON recharge_requests;
CREATE TRIGGER update_recharge_requests_updated_at
    BEFORE UPDATE ON recharge_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. 创建用于查询的视图（可选）
CREATE OR REPLACE VIEW recharge_requests_with_users AS
SELECT
    rr.*,
    u.email as user_email,
    u.raw_user_meta_data as user_metadata,
    processor.email as processed_by_email
FROM recharge_requests rr
LEFT JOIN auth.users u ON rr.user_id = u.id
LEFT JOIN auth.users processor ON rr.processed_by = processor.id;

-- 8. 创建用于统计的函数
CREATE OR REPLACE FUNCTION get_recharge_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
    pending_count BIGINT,
    pending_amount DECIMAL,
    approved_count BIGINT,
    approved_amount DECIMAL,
    total_count BIGINT,
    total_amount DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as approved_amount,
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_amount
    FROM recharge_requests
    WHERE (p_user_id IS NULL OR user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

-- 9. 验证创建结果
SELECT 'payment_qrcodes 表创建完成' as status;
SELECT COUNT(*) as qr_code_count FROM payment_qrcodes WHERE is_active = true;

SELECT 'recharge_requests 表创建完成' as status;
SELECT COUNT(*) as table_exists FROM information_schema.tables WHERE table_name = 'recharge_requests';

SELECT '触发器函数创建完成' as status;
SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'update_updated_at_column'
) as function_exists;

-- 10. 显示当前数据
SELECT '当前 payment_qrcodes 表数据:' as info;
SELECT
    id,
    payment_type,
    SUBSTRING(qr_code_url, 1, 50) || '...' as qr_code_preview,
    description,
    is_active,
    created_at
FROM payment_qrcodes
ORDER BY created_at;

-- =====================================================
-- 执行完成！
--
-- 现在你可以：
-- 1. 在前端应用中查询 payment_qrcodes 表获取收款二维码
-- 2. 向 recharge_requests 表插入充值请求数据
-- 3. 使用触发器自动更新 updated_at 字段
-- 4. 使用统计函数获取充值数据
-- =====================================================