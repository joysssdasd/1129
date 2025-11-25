-- Migration: fix_storage_buckets_policies
-- Created at: 1762925233

-- 为storage.buckets表创建RLS策略，允许公开访问

-- 允许公开查看所有存储桶
CREATE POLICY "Public Access for storage buckets" ON storage.buckets
FOR SELECT USING (true);

-- 允许service_role管理存储桶
CREATE POLICY "Service role can manage buckets" ON storage.buckets
FOR ALL USING (auth.role() = 'service_role');;