-- Migration: fix_payment_qrcodes_insert_policy
-- Created at: 1762867025

-- 删除现有的有问题的INSERT策略
DROP POLICY IF EXISTS "Only admins can insert payment qrcodes" ON payment_qrcodes;

-- 创建新的正确的INSERT策略，只有管理员可以插入
CREATE POLICY "Allow admins to insert payment qrcodes" ON payment_qrcodes
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth.uid() IN (
        SELECT id FROM users WHERE is_admin = true OR role = 'admin'
    )
);;