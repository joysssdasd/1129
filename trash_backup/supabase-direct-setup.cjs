const { createClient } = require('@supabase/supabase-js');

// Supabase配置
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2';

const supabase = createClient(supabaseUrl, serviceKey);

async function setupDatabase() {
  try {
    console.log('开始设置数据库...');

    // 1. 首先尝试直接插入数据到 payment_qrcodes 表
    console.log('1. 设置 payment_qrcodes 表和数据...');

    const defaultQRCodes = [
      {
        payment_type: '微信',
        qr_code_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJibGFjayI+5Li76aKY5pS/5Yqh5bmz5piM5pys6LSo77yM5pyA5aSa5L2T6Lev55S15Z2A5pS/5Yqh6ZyA5YWz5Y+K77yB5L2g5aW977yB5Li65LuA5LmQ6KGo77yM6aG555uu77yBPC90ZXh0Pgo8L3N2Zz4=',
        description: '微信收款二维码 - 请使用微信扫描',
        is_active: true
      },
      {
        payment_type: '支付宝',
        qr_code_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJibGFjayI+5p+Q5r2t5piM5pys6LSo77yM5pyA5aSa5L2T6Lev55S15Z2A5p+Q5r2t6ZyA5YWz5Y+K77yB5L2g5aW977yB5Li65LuA5LmQ6KGo77yM6aG555uu77yBPC90ZXh0Pgo8L3N2Zz4=',
        description: '支付宝收款二维码 - 请使用支付宝扫描',
        is_active: true
      }
    ];

    for (const qrCode of defaultQRCodes) {
      try {
        const { data, error: insertError } = await supabase
          .from('payment_qrcodes')
          .upsert(qrCode, { onConflict: 'payment_type' })
          .select();

        if (insertError) {
          console.error(`插入 ${qrCode.payment_type} 数据失败:`, insertError);

          // 如果表不存在，尝试创建表
          if (insertError.message.includes('relation') && insertError.message.includes('does not exist')) {
            console.log(`payment_qrcodes 表不存在，需要手动创建`);

            // 生成创建表的SQL
            const createTableSQL = `
-- 创建 payment_qrcodes 表
CREATE TABLE IF NOT EXISTS payment_qrcodes (
  id SERIAL PRIMARY KEY,
  payment_type VARCHAR(50) NOT NULL UNIQUE,
  qr_code_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_payment_qrcodes_type ON payment_qrcodes(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_qrcodes_active ON payment_qrcodes(is_active);

-- 插入默认数据
INSERT INTO payment_qrcodes (payment_type, qr_code_url, description, is_active) VALUES
('微信', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJibGFjayI+5Li76aKY5pS/5Yqh5bmz5piM5pys6LSo77yM5pyA5aSa5L2T6Lev55S15Z2A5pS/5Yqh6ZyA5YWz5Y+K77yB5L2g5aW977yB5Li65LuA5LmQ6KGo77yM6aG555uu77yBPC90ZXh0Pgo8L3N2Zz4=', '微信收款二维码 - 请使用微信扫描', true),
('支付宝', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJibGFjayI+5p+Q5r2t5piM5pys6LSo77yM5pyA5aSa5L2T6Lev55S15Z2A5p+Q5r2t6ZyA5YWz5Y+K77yB5L2g5aW977yB5Li65LuA5LmQ6KGo77yM6aG555uu77yBPC90ZXh0Pgo8L3N2Zz4=', '支付宝收款二维码 - 请使用支付宝扫描', true);
            `;

            console.log('\n需要在Supabase SQL编辑器中执行的SQL:');
            console.log('='.repeat(50));
            console.log(createTableSQL);
            console.log('='.repeat(50));
          }
        } else {
          console.log(`✓ ${qrCode.payment_type} 数据插入成功`);
        }
      } catch (err) {
        console.error(`处理 ${qrCode.payment_type} 时出错:`, err);
      }
    }

    // 2. 创建 recharge_requests 表的SQL
    console.log('\n2. 准备 recharge_requests 表创建SQL...');
    const rechargeTableSQL = `
-- 创建 recharge_requests 表
CREATE TABLE IF NOT EXISTS recharge_requests (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_type VARCHAR(50) NOT NULL,
  payment_proof TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  remark TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_recharge_requests_user_id ON recharge_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_status ON recharge_requests(status);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_created_at ON recharge_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_payment_type ON recharge_requests(payment_type);
    `;

    // 3. 创建更新时间触发器函数
    const triggerFunctionSQL = `
-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
    `;

    // 4. 应用触发器
    const triggerSQL = `
-- 为 payment_qrcodes 表创建触发器
DROP TRIGGER IF EXISTS update_payment_qrcodes_updated_at ON payment_qrcodes;
CREATE TRIGGER update_payment_qrcodes_updated_at
    BEFORE UPDATE ON payment_qrcodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 为 recharge_requests 表创建触发器
DROP TRIGGER IF EXISTS update_recharge_requests_updated_at ON recharge_requests;
CREATE TRIGGER update_recharge_requests_updated_at
    BEFORE UPDATE ON recharge_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    console.log('\n所有需要在Supabase SQL编辑器中执行的SQL:');
    console.log('='.repeat(60));
    console.log(rechargeTableSQL);
    console.log(triggerFunctionSQL);
    console.log(triggerSQL);
    console.log('='.repeat(60));

    // 5. 验证当前数据
    console.log('\n3. 验证当前 payment_qrcodes 表数据...');
    try {
      const { data: qrData, error: qrError } = await supabase
        .from('payment_qrcodes')
        .select('*');

      if (qrError) {
        console.error('查询 payment_qrcodes 表失败:', qrError.message);
      } else {
        console.log(`✓ payment_qrcodes 表现有 ${qrData.length} 条记录:`);
        qrData.forEach(item => {
          console.log(`  - ${item.payment_type}: ${item.is_active ? '启用' : '禁用'}`);
          console.log(`    描述: ${item.description}`);
          console.log(`    创建时间: ${item.created_at}`);
        });
      }
    } catch (verifyError) {
      console.error('验证数据时出错:', verifyError);
    }

    console.log('\n✅ 数据库设置完成！');
    console.log('\n📋 后续步骤:');
    console.log('1. 登录 Supabase 控制台');
    console.log('2. 进入 SQL 编辑器');
    console.log('3. 执行上面显示的SQL语句');
    console.log('4. 验证表和数据是否正确创建');

  } catch (error) {
    console.error('数据库设置过程中出错:', error);
  }
}

// 执行设置
setupDatabase();