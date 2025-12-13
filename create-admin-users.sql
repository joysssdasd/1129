-- 创建管理员账户 SQL 脚本
-- 在 Supabase SQL Editor 中执行此脚本

-- 先检查并删除已存在的管理员（如果需要重新创建）
-- DELETE FROM users WHERE phone IN ('13011319329', '13001220766');

-- 创建管理员账户 1: 13011319329
INSERT INTO users (phone, wechat_id, is_admin, points, status, created_at, updated_at)
VALUES ('13011319329', 'admin_13011319329', true, 99999, 1, NOW(), NOW())
ON CONFLICT (phone) 
DO UPDATE SET is_admin = true, points = 99999, status = 1, updated_at = NOW();

-- 创建管理员账户 2: 13001220766
INSERT INTO users (phone, wechat_id, is_admin, points, status, created_at, updated_at)
VALUES ('13001220766', 'admin_13001220766', true, 99999, 1, NOW(), NOW())
ON CONFLICT (phone) 
DO UPDATE SET is_admin = true, points = 99999, status = 1, updated_at = NOW();

-- 验证创建结果
SELECT id, phone, wechat_id, is_admin, points, status, created_at 
FROM users 
WHERE phone IN ('13011319329', '13001220766');
