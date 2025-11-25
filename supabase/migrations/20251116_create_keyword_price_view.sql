-- Create a materialized view for keyword price analysis
-- This will be used for K-line chart data

CREATE TABLE IF NOT EXISTS keyword_price_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword VARCHAR(200) NOT NULL,
    trade_type INTEGER NOT NULL,
    snapshot_date DATE NOT NULL,
    open_price DECIMAL(10,2),
    close_price DECIMAL(10,2),
    high_price DECIMAL(10,2),
    low_price DECIMAL(10,2),
    avg_price DECIMAL(10,2),
    post_count INTEGER DEFAULT 0,
    total_volume DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(keyword, trade_type, snapshot_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_keyword_snapshots_keyword ON keyword_price_snapshots(keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_snapshots_date ON keyword_price_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_keyword_snapshots_keyword_date ON keyword_price_snapshots(keyword, snapshot_date DESC);

-- Create a function to aggregate daily price data
CREATE OR REPLACE FUNCTION aggregate_keyword_prices(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
    -- Aggregate price data for each keyword and trade type
    INSERT INTO keyword_price_snapshots (
        keyword,
        trade_type,
        snapshot_date,
        open_price,
        close_price,
        high_price,
        low_price,
        avg_price,
        post_count,
        total_volume
    )
    SELECT 
        keywords,
        trade_type,
        target_date,
        (ARRAY_AGG(price ORDER BY created_at ASC))[1] as open_price,
        (ARRAY_AGG(price ORDER BY created_at DESC))[1] as close_price,
        MAX(price) as high_price,
        MIN(price) as low_price,
        AVG(price) as avg_price,
        COUNT(*) as post_count,
        SUM(price) as total_volume
    FROM posts
    WHERE DATE(created_at) = target_date
        AND status = 1
    GROUP BY keywords, trade_type
    ON CONFLICT (keyword, trade_type, snapshot_date)
    DO UPDATE SET
        open_price = EXCLUDED.open_price,
        close_price = EXCLUDED.close_price,
        high_price = EXCLUDED.high_price,
        low_price = EXCLUDED.low_price,
        avg_price = EXCLUDED.avg_price,
        post_count = EXCLUDED.post_count,
        total_volume = EXCLUDED.total_volume;
END;
$$ LANGUAGE plpgsql;
