-- Migration: add_password_to_users
-- Created at: 1762768095

-- 添加password字段到users表
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);;