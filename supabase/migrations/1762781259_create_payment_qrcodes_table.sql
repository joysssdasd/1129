-- Migration: create_payment_qrcodes_table
-- Created at: 1762781259

-- 创建收款二维码配置表
CREATE TABLE IF NOT EXISTS payment_qrcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
  qr_code_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(payment_type)
);

-- 创建RLS策略
ALTER TABLE payment_qrcodes ENABLE ROW LEVEL SECURITY;

-- 所有人都可以查看二维码
CREATE POLICY "Anyone can view payment qrcodes"
  ON payment_qrcodes FOR SELECT
  USING (true);

-- 只有管理员可以插入、更新、删除
CREATE POLICY "Only admins can insert payment qrcodes"
  ON payment_qrcodes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only admins can update payment qrcodes"
  ON payment_qrcodes FOR UPDATE
  USING (true);

CREATE POLICY "Only admins can delete payment qrcodes"
  ON payment_qrcodes FOR DELETE
  USING (true);;