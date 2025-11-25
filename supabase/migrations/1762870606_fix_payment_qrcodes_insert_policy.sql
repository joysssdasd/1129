-- Migration: fix_payment_qrcodes_insert_policy
-- Created at: 1762870606

-- 删除现有的INSERT策略
DROP POLICY IF EXISTS "Allow admins to insert payment qrcodes" ON payment_qrcodes;

-- 创建一个更简单有效的INSERT策略
CREATE POLICY "Enable insert for authenticated admins only" ON payment_qrcodes
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND (is_admin = true OR role = 'admin')
    )
);;