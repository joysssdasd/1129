-- 添加微信行情帖子相关字段
-- 用于区分用户发布和微信自动同步的帖子

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'user'
    CHECK (source_type IN ('user', 'wechat_market'));

-- 行情唯一标识，用于幂等同步
-- 格式: 板块-标的-档位-方向 (如: 演唱会-周杰伦-780档-出)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS market_key TEXT;

-- 行情板块分类
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS market_board TEXT
    CHECK (market_board IN ('演唱会', '数码和茅台', '贵金属', '纪念币/钞'));

-- 原始行情数据快照
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS market_data JSONB;

-- 同步批次ID
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS run_id TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_posts_source_type ON posts(source_type);
CREATE INDEX IF NOT EXISTS idx_posts_market_key ON posts(market_key) WHERE market_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_market_board ON posts(market_board) WHERE market_board IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_run_id ON posts(run_id) WHERE run_id IS NOT NULL;

-- 添加唯一约束（可选，如果需要保证同一 market_key 同一日期只有一条）
-- 注意：这需要先清理重复数据
-- ALTER TABLE posts ADD CONSTRAINT unique_market_key_per_day
--   EXCLUDE USING gist (
--     market_key WITH =,
--     run_id WITH =
--   ) WHERE (market_key IS NOT NULL);

COMMENT ON COLUMN posts.source_type IS '帖子来源: user=用户发布, wechat_market=微信行情同步';
COMMENT ON COLUMN posts.market_key IS '行情唯一标识，用于幂等同步';
COMMENT ON COLUMN posts.market_board IS '行情板块: 演唱会/数码和茅台/贵金属/纪念币/钞';
COMMENT ON COLUMN posts.market_data IS '原始行情数据快照';
COMMENT ON COLUMN posts.run_id IS '同步批次ID，用于追踪同步记录';