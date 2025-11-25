-- Migration: fix_storage_objects_policies
-- Created at: 1762924946

-- 为storage.objects表创建RLS策略，允许公开访问payment-qrcodes bucket

-- 允许公开查看payment-qrcodes bucket中的对象
CREATE POLICY "Public Access for payment-qrcodes SELECT" ON storage.objects
FOR SELECT USING (bucket_id = 'payment-qrcodes');

-- 允许公开上传到payment-qrcodes bucket
CREATE POLICY "Public Access for payment-qrcodes INSERT" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'payment-qrcodes');

-- 允许公开更新payment-qrcodes bucket中的对象
CREATE POLICY "Public Access for payment-qrcodes UPDATE" ON storage.objects
FOR UPDATE USING (bucket_id = 'payment-qrcodes');

-- 允许公开删除payment-qrcodes bucket中的对象
CREATE POLICY "Public Access for payment-qrcodes DELETE" ON storage.objects
FOR DELETE USING (bucket_id = 'payment-qrcodes');;