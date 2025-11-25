-- Migration: add_wechat_and_antifraud_fields
-- Created at: 1763302154

ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_openid VARCHAR(100) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_unionid VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_nickname VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS register_ip VARCHAR(45);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
UPDATE users SET role = 'admin' WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_users_wechat_openid ON users(wechat_openid);
CREATE INDEX IF NOT EXISTS idx_users_device_fingerprint ON users(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);;