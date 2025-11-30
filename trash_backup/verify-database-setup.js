// 数据库设置验证脚本
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2';

const supabase = createClient(supabaseUrl, serviceKey);

async function verifySetup() {
  console.log('🔍 开始验证数据库设置...\n');

  try {
    // 1. 验证 payment_qrcodes 表
    console.log('1️⃣ 验证 payment_qrcodes 表');
    console.log('='.repeat(30));

    try {
      const { data: qrData, error: qrError } = await supabase
        .from('payment_qrcodes')
        .select('*');

      if (qrError) {
        console.error('❌ payment_qrcodes 表查询失败:', qrError.message);
        if (qrError.message.includes('does not exist')) {
          console.log('⚠️  表不存在，请先执行 SQL 设置脚本');
        }
      } else {
        console.log(`✅ payment_qrcodes 表存在，共 ${qrData.length} 条记录`);
        qrData.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.payment_type}`);
          console.log(`     描述: ${item.description}`);
          console.log(`     状态: ${item.is_active ? '启用' : '禁用'}`);
          console.log(`     创建时间: ${new Date(item.created_at).toLocaleString('zh-CN')}`);
          console.log('');
        });
      }
    } catch (err) {
      console.error('❌ 连接失败:', err.message);
      return;
    }

    // 2. 验证 recharge_requests 表
    console.log('\n2️⃣ 验证 recharge_requests 表');
    console.log('='.repeat(30));

    try {
      const { data: rechargeData, error: rechargeError } = await supabase
        .from('recharge_requests')
        .select('id, user_id, amount, payment_type, status, created_at')
        .limit(5);

      if (rechargeError) {
        console.error('❌ recharge_requests 表查询失败:', rechargeError.message);
        if (rechargeError.message.includes('does not exist')) {
          console.log('⚠️  表不存在，请先执行 SQL 设置脚本');
        }
      } else {
        console.log(`✅ recharge_requests 表存在，最近 ${rechargeData.length} 条记录`);
        if (rechargeData.length === 0) {
          console.log('   (暂无充值记录，这是正常的)');
        } else {
          rechargeData.forEach((item, index) => {
            console.log(`  ${index + 1}. 订单 #${item.id}`);
            console.log(`     金额: ¥${item.amount}`);
            console.log(`     支付方式: ${item.payment_type}`);
            console.log(`     状态: ${item.status}`);
            console.log(`     时间: ${new Date(item.created_at).toLocaleString('zh-CN')}`);
            console.log('');
          });
        }
      }
    } catch (err) {
      console.error('❌ 查询充值记录时出错:', err.message);
    }

    // 3. 测试统计函数
    console.log('\n3️⃣ 测试统计函数');
    console.log('='.repeat(30));

    try {
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_recharge_stats');

      if (statsError) {
        console.error('❌ 统计函数调用失败:', statsError.message);
        console.log('⚠️  请确保已创建 get_recharge_stats 函数');
      } else {
        console.log('✅ 统计函数工作正常');
        if (statsData && statsData.length > 0) {
          const stats = statsData[0];
          console.log(`   待处理数量: ${stats.pending_count} 笔 (¥${stats.pending_amount})`);
          console.log(`   已通过数量: ${stats.approved_count} 笔 (¥${stats.approved_amount})`);
          console.log(`   总计数量: ${stats.total_count} 笔 (¥${stats.total_amount})`);
        }
      }
    } catch (err) {
      console.error('❌ 测试统计函数时出错:', err.message);
    }

    // 4. 前端集成示例
    console.log('\n4️⃣ 前端集成示例代码');
    console.log('='.repeat(30));

    console.log('// 获取收款二维码');
    console.log('const { data: qrCodes } = await supabase');
    console.log('  .from("payment_qrcodes")');
    console.log('  .select("*")');
    console.log('  .eq("is_active", true);');
    console.log('');

    console.log('// 提交充值请求');
    console.log('const { data: newRequest } = await supabase');
    console.log('  .from("recharge_requests")');
    console.log('  .insert([{');
    console.log('    user_id: userId,');
    console.log('    amount: 100.00,');
    console.log('    payment_type: "微信",');
    console.log('    payment_proof: "凭证图片URL",');
    console.log('    remark: "用户备注"');
    console.log('  }]);');
    console.log('');

    // 5. 下一步操作建议
    console.log('5️⃣ 下一步操作建议');
    console.log('='.repeat(30));

    console.log('✅ 如果以上验证都通过，数据库设置已完成！');
    console.log('');
    console.log('📝 接下来你需要：');
    console.log('1. 在前端应用中集成这些表');
    console.log('2. 添加 RLS (Row Level Security) 策略');
    console.log('3. 替换占位二维码为真实的收款二维码');
    console.log('4. 实现充值审核流程');
    console.log('');
    console.log('⚠️  如果有任何错误，请：');
    console.log('1. 检查 Supabase SQL 编辑器中的执行结果');
    console.log('2. 确认表是否正确创建');
    console.log('3. 检查外键约束是否正确');

  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
  }
}

// 执行验证
verifySetup();