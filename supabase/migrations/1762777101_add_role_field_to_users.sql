-- Migration: add_role_field_to_users
-- Created at: 1762777101

-- 添加role字段到users表
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- 更新现有管理员账户
UPDATE users SET role = 'admin' WHERE phone = '13800138000';

-- 创建管理员专用账户 13011319329
INSERT INTO users (phone, wechat_id, invite_code, points, status, is_admin, role, created_at, updated_at)
VALUES ('13011319329', 'admin_wechat', 'ADMIN2025', 1000, 1, true, 'admin', NOW(), NOW())
ON CONFLICT (phone) 
DO UPDATE SET 
  role = 'admin', 
  is_admin = true,
  status = 1,
  password = NULL;  -- 确保管理员没有密码;