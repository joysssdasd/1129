-- Migration: add_foreign_key_recharge_requests_users
-- Created at: 1762787482


-- 添加recharge_requests到users的外键关系
ALTER TABLE recharge_requests
ADD CONSTRAINT recharge_requests_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 添加admin_id的外键关系
ALTER TABLE recharge_requests
ADD CONSTRAINT recharge_requests_admin_id_fkey
FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;
;