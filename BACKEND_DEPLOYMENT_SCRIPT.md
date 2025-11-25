# Backend Deployment Script
# Execute this after Supabase token is refreshed

## Step 1: Apply Database Migrations

echo "Step 1: Applying database migrations..."

### Migration 1: Add WeChat and Anti-fraud Fields
apply_migration(
  name="add_wechat_and_antifraud_fields",
  query="""
-- Add WeChat login fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_openid VARCHAR(100) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_unionid VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_nickname VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_avatar TEXT;

-- Add anti-fraud tracking fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS register_ip VARCHAR(45);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add role field
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Update existing admin users
UPDATE users SET role = 'admin' WHERE is_admin = true;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_wechat_openid ON users(wechat_openid);
CREATE INDEX IF NOT EXISTS idx_users_device_fingerprint ON users(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
"""
)

### Migration 2: Create Price Analytics Tables
apply_migration(
  name="create_keyword_price_view",
  query="""
-- Create table for keyword price snapshots
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

-- Create function to aggregate daily price data
CREATE OR REPLACE FUNCTION aggregate_keyword_prices(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
    INSERT INTO keyword_price_snapshots (
        keyword, trade_type, snapshot_date,
        open_price, close_price, high_price, low_price,
        avg_price, post_count, total_volume
    )
    SELECT 
        keywords, trade_type, target_date,
        (ARRAY_AGG(price ORDER BY created_at ASC))[1] as open_price,
        (ARRAY_AGG(price ORDER BY created_at DESC))[1] as close_price,
        MAX(price) as high_price,
        MIN(price) as low_price,
        AVG(price) as avg_price,
        COUNT(*) as post_count,
        SUM(price) as total_volume
    FROM posts
    WHERE DATE(created_at) = target_date AND status = 1
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
"""
)

echo "✅ Database migrations applied successfully"

## Step 2: Deploy Edge Functions

echo "Step 2: Deploying edge functions..."

batch_deploy_edge_functions(
  functions=[
    {
      "slug": "get-invitation-info",
      "file_path": "/workspace/supabase/functions/get-invitation-info/index.ts",
      "type": "normal",
      "description": "Get invitation statistics and generate invitation link"
    },
    {
      "slug": "process-referral-reward",
      "file_path": "/workspace/supabase/functions/process-referral-reward/index.ts",
      "type": "normal",
      "description": "Process referral rewards for new user registration"
    },
    {
      "slug": "get-keyword-analytics",
      "file_path": "/workspace/supabase/functions/get-keyword-analytics/index.ts",
      "type": "normal",
      "description": "Get keyword price analytics data for K-line charts"
    }
  ]
)

# Also re-deploy updated function
batch_deploy_edge_functions(
  functions=[
    {
      "slug": "register-with-password",
      "file_path": "/workspace/supabase/functions/register-with-password/index.ts",
      "type": "normal",
      "description": "User registration with password (updated for new reward system)"
    }
  ]
)

echo "✅ Edge functions deployed successfully"

## Step 3: Test Edge Functions

echo "Step 3: Testing edge functions..."

# Test get-invitation-info
test_edge_function(
  function_url="${SUPABASE_URL}/functions/v1/get-invitation-info",
  test_data={}
)

# Test get-keyword-analytics
test_edge_function(
  function_url="${SUPABASE_URL}/functions/v1/get-keyword-analytics",
  test_data={"days": 30, "mode": "realtime"}
)

echo "✅ All backend components deployed and tested"
echo "🎉 Deployment complete! Ready for end-to-end testing"
