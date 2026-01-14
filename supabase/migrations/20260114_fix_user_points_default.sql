-- ============================================
-- 修复用户积分默认值 - 2026年1月14日
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 步骤1: 先查看当前有问题的用户
SELECT id, phone, points, invited_by, total_posts, created_at
FROM users 
WHERE created_at >= CURRENT_DATE - INTERVAL '3 days'
  AND points < 100
ORDER BY created_at DESC;

-- 步骤2: 确保数据库默认值为100
ALTER TABLE users ALTER COLUMN points SET DEFAULT 100;

-- 步骤3: 修复积分异常的用户
-- 没有邀请人的用户应该有100积分
-- 有邀请人的用户应该有130积分（100基础 + 30邀请奖励）
UPDATE users 
SET points = CASE 
    WHEN invited_by IS NOT NULL THEN points + 100  -- 补发100基础积分
    ELSE points + 70  -- 如果只有30积分，补发70积分到100
END
WHERE created_at >= CURRENT_DATE - INTERVAL '3 days'
  AND points < 100
  AND total_posts = 0;

-- 步骤4: 验证修复结果
SELECT id, phone, points, invited_by, total_posts, created_at
FROM users 
WHERE created_at >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY created_at DESC;
