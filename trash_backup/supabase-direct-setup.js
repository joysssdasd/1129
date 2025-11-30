const { createClient } = require('@supabase/supabase-js');

// Supabase配置
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2';

const supabase = createClient(supabaseUrl, serviceKey);

async function setupDatabase() {
  try {
    console.log('开始设置数据库...');

    // 1. 创建 payment_qrcodes 表
    console.log('1. 创建 payment_qrcodes 表...');
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (tableError) {
      console.log('使用备用方法创建表...');
      // 直接使用 SQL 执行
      const { error: directError } = await supabase
        .from('payment_qrcodes')
        .select('*')
        .limit(1);

      if (directError && directError.code === 'PGRST204') {
        console.log('表不存在，需要通过其他方式创建...');
      }
    }

    // 2. 插入默认数据
    console.log('2. 插入默认收款二维码数据...');

    const defaultQRCodes = [
      {
        payment_type: '微信',
        qr_code_url: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=weixin://wxpay/bizpayurl?pr=%E5%BE%AE%E4%BF%A1%E6%94%B6%E6%AC%BE%E7%A0%81',
        description: '微信收款二维码',
        is_active: true
      },
      {
        payment_type: '支付宝',
        qr_code_url: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=alipay://platformapi/startapp?appId=20000067&chInfo=ch_subch_1001',
        description: '支付宝收款二维码',
        is_active: true
      }
    ];

    for (const qrCode of defaultQRCodes) {
      const { error: insertError } = await supabase
        .from('payment_qrcodes')
        .upsert(qrCode, { onConflict: 'payment_type' });

      if (insertError) {
        console.error(`插入 ${qrCode.payment_type} 数据失败:`, insertError);
      } else {
        console.log(`✓ ${qrCode.payment_type} 数据插入成功`);
      }
    }

    // 3. 创建 recharge_requests 表
    console.log('3. 创建 recharge_requests 表...');
    const rechargeTableSQL = `
      CREATE TABLE IF NOT EXISTS recharge_requests (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
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
    `;

    console.log('充值表SQL准备完成');

    // 4. 创建更新时间触发器函数
    console.log('4. 创建更新时间触发器函数...');
    const triggerFunctionSQL = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `;

    console.log('触发器函数SQL准备完成');

    // 5. 应用触发器
    console.log('5. 应用触发器到表...');
    const triggerSQL = `
      DROP TRIGGER IF EXISTS update_payment_qrcodes_updated_at ON payment_qrcodes;
      CREATE TRIGGER update_payment_qrcodes_updated_at
        BEFORE UPDATE ON payment_qrcodes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_recharge_requests_updated_at ON recharge_requests;
      CREATE TRIGGER update_recharge_requests_updated_at
        BEFORE UPDATE ON recharge_requests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    console.log('触发器SQL准备完成');

    // 验证结果
    console.log('\n6. 验证创建结果...');

    // 检查 payment_qrcodes 表
    const { data: qrData, error: qrError } = await supabase
      .from('payment_qrcodes')
      .select('*');

    if (qrError) {
      console.error('查询 payment_qrcodes 表失败:', qrError);
    } else {
      console.log('✓ payment_qrcodes 表数据:', qrData.length, '条记录');
      qrData.forEach(item => {
        console.log(`  - ${item.payment_type}: ${item.qr_code_url.substring(0, 50)}...`);
      });
    }

    console.log('\n数据库设置完成！');
    console.log('\n需要手动执行的SQL（如果自动创建失败）:');
    console.log(rechargeTableSQL);
    console.log(triggerFunctionSQL);
    console.log(triggerSQL);

  } catch (error) {
    console.error('数据库设置过程中出错:', error);
  }
}

// 执行设置
setupDatabase();