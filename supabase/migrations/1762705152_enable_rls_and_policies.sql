-- Migration: enable_rls_and_policies
-- Created at: 1762705152

-- 启用RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recharge_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许service_role和anon访问所有表
CREATE POLICY "Allow all for service role and anon" ON users
FOR ALL USING (auth.role() IN ('anon', 'service_role', 'authenticated'));

CREATE POLICY "Allow all for service role and anon" ON posts
FOR ALL USING (auth.role() IN ('anon', 'service_role', 'authenticated'));

CREATE POLICY "Allow all for service role and anon" ON point_transactions
FOR ALL USING (auth.role() IN ('anon', 'service_role', 'authenticated'));

CREATE POLICY "Allow all for service role and anon" ON recharge_requests
FOR ALL USING (auth.role() IN ('anon', 'service_role', 'authenticated'));

CREATE POLICY "Allow all for service role and anon" ON admin_settings
FOR ALL USING (auth.role() IN ('anon', 'service_role', 'authenticated'));

CREATE POLICY "Allow all for service role and anon" ON view_history
FOR ALL USING (auth.role() IN ('anon', 'service_role', 'authenticated'));

CREATE POLICY "Allow all for service role and anon" ON invitations
FOR ALL USING (auth.role() IN ('anon', 'service_role', 'authenticated'));

CREATE POLICY "Allow all for service role and anon" ON verification_codes
FOR ALL USING (auth.role() IN ('anon', 'service_role', 'authenticated'));

CREATE POLICY "Allow all for service role and anon" ON announcements
FOR ALL USING (auth.role() IN ('anon', 'service_role', 'authenticated'));;