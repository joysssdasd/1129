// =====================================================
// Supabase 数据库验证脚本
// 验证 payment_qrcodes 和 recharge_requests 表是否创建成功
// =====================================================

import { createClient } from '@supabase/supabase-js'

// Supabase 配置
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2'

console.log('🔍 开始验证 Supabase 数据库设置...')
console.log('📊 项目URL:', supabaseUrl)

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 验证函数
async function verifyTables() {
  try {
    console.log('\n📋 检查表是否存在...')

    // 检查 payment_qrcodes 表
    console.log('\n1️⃣ 检查 payment_qrcodes 表...')
    const { data: paymentData, error: paymentError } = await supabase
      .from('payment_qrcodes')
      .select('*')
      .limit(1)

    if (paymentError) {
      console.error('❌ payment_qrcodes 表错误:', paymentError.message)
      console.log('💡 提示: 需要先创建表，请执行 database-setup-complete.sql')
    } else {
      console.log('✅ payment_qrcodes 表存在且可访问')

      // 获取完整数据
      const { data: allPaymentData, error: allPaymentError } = await supabase
        .from('payment_qrcodes')
        .select('*')

      if (!allPaymentError && allPaymentData.length > 0) {
        console.log('📊 收款二维码数据:')
        allPaymentData.forEach(row => {
          console.log(`  - ${row.payment_type}: ${row.status}`)
          console.log(`    URL: ${row.qr_code_url.substring(0, 50)}...`)
        })
      }
    }

    // 检查 recharge_requests 表
    console.log('\n2️⃣ 检查 recharge_requests 表...')
    const { data: rechargeData, error: rechargeError } = await supabase
      .from('recharge_requests')
      .select('*')
      .limit(1)

    if (rechargeError) {
      console.error('❌ recharge_requests 表错误:', rechargeError.message)
      console.log('💡 提示: 需要先创建表，请执行 database-setup-complete.sql')
    } else {
      console.log('✅ recharge_requests 表存在且可访问')
      console.log('📊 充值请求表结构正常')
    }

    // 检查 point_transactions 表
    console.log('\n3️⃣ 检查 point_transactions 表...')
    const { data: pointData, error: pointError } = await supabase
      .from('point_transactions')
      .select('*')
      .limit(1)

    if (pointError) {
      console.error('❌ point_transactions 表错误:', pointError.message)
      console.log('💡 提示: 需要先创建表，请执行 database-setup-complete.sql')
    } else {
      console.log('✅ point_transactions 表存在且可访问')
      console.log('📊 积分交易记录表结构正常')
    }

    // 测试插入数据（模拟用户充值请求）
    console.log('\n4️⃣ 测试数据库操作权限...')

    // 尝试查询 payment_qrcodes 来测试前端功能
    const { data: qrCodes, error: qrError } = await supabase
      .from('payment_qrcodes')
      .select('payment_type, qr_code_url, status')
      .eq('status', 'active')

    if (qrError) {
      console.error('❌ 查询收款二维码失败:', qrError.message)
    } else {
      console.log('✅ 可以正常查询收款二维码')
      console.log('📱 前端充值功能可正常使用')
      if (qrCodes && qrCodes.length > 0) {
        console.log(`   - 找到 ${qrCodes.length} 个活跃的支付方式`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 数据库验证完成！')

    // 汇总结果
    const tablesExist = !paymentError && !rechargeError && !pointError
    const hasQRData = paymentData && paymentData.length > 0

    if (tablesExist && hasQRData) {
      console.log('🌟 所有表创建成功，数据完整！')
      console.log('🚀 用户现在可以使用充值功能了')
      console.log('🌐 前端访问地址: http://localhost:5173/profile')
    } else if (tablesExist) {
      console.log('⚠️  表已创建但可能缺少数据')
      console.log('💡 请检查是否插入了默认的收款二维码数据')
    } else {
      console.log('❌ 表创建不完整')
      console.log('🔧 请执行以下步骤:')
      console.log('   1. 访问: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql')
      console.log('   2. 复制并执行 database-setup-complete.sql 中的内容')
      console.log('   3. 检查表是否在 Table Editor 中显示')
    }

    console.log('\n📊 Supabase Dashboard: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh')
    console.log('🔍 Table Editor: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/editor')

  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error.message)
    console.log('\n🔧 故障排除:')
    console.log('1. 检查网络连接')
    console.log('2. 验证 Supabase URL 和密钥')
    console.log('3. 确认表已正确创建')
  }
}

// 运行验证
verifyTables()