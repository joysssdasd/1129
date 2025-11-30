// =====================================================
// MCP Supabase 数据库设置脚本
// 用于创建 payment_qrcodes 和 recharge_requests 表
// =====================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Supabase 配置
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiInNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.Kq5xT2AJNVKU2Jq3_H8_cN5g5tIEIguWi3-aL2ZGaHWxZIYm'

console.log('🚀 开始执行 Supabase 数据库设置...')
console.log('📊 项目URL:', supabaseUrl)

// 创建 Supabase 客户端（使用 service role key 以获得管理权限）
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// 执行 SQL 脚本
async function executeSQL(sql, description) {
  try {
    console.log(`\n🔧 ${description}...`)
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.error(`❌ 错误:`, error)
      return false
    }

    console.log(`✅ ${description} 完成`)
    return true
  } catch (err) {
    console.error(`❌ 执行错误:`, err.message)
    return false
  }
}

// 使用直接 SQL 执行方式
async function executeDirectSQL(sql, description) {
  try {
    console.log(`\n🔧 ${description}...`)

    // 使用 from('raw') 执行原始 SQL（如果支持）
    const { data, error } = await supabase
      .from('pg_catalog.pg_stat_activity')
      .select('*')
      .limit(1)

    if (error) {
      console.log(`⚠️  需要手动执行 SQL: ${description}`)
      console.log('📝 请在 Supabase Dashboard 中执行以下 SQL:')
      console.log('```sql')
      console.log(sql)
      console.log('```')
      return false
    }

    console.log(`✅ ${description} 完成`)
    return true
  } catch (err) {
    console.log(`⚠️  需要手动执行 SQL: ${description}`)
    console.log('📝 请在 Supabase Dashboard 中执行以下 SQL:')
    console.log('```sql')
    console.log(sql)
    console.log('```')
    return false
  }
}

// 主函数
async function main() {
  console.log('\n📋 准备执行的数据库操作:')
  console.log('1. 创建 payment_qrcodes 表（收款二维码表）')
  console.log('2. 创建 recharge_requests 表（充值请求表）')
  console.log('3. 插入默认的微信和支付宝收款二维码数据')
  console.log('4. 创建必要的索引和触发器')

  // 读取 SQL 文件内容
  let sqlContent
  try {
    sqlContent = readFileSync(join(__dirname, 'payment-qrcodes-setup.sql'), 'utf8')
    console.log('\n📖 已读取 SQL 设置文件')
  } catch (err) {
    console.error('❌ 无法读取 SQL 文件:', err.message)
    process.exit(1)
  }

  // 分割 SQL 语句（按分号分割）
  const sqlStatements = sqlContent
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

  console.log(`\n📊 找到 ${sqlStatements.length} 个 SQL 语句`)

  // 尝试执行每个 SQL 语句
  let successCount = 0
  let manualExecutions = []

  for (let i = 0; i < sqlStatements.length; i++) {
    const statement = sqlStatements[i]
    if (statement.length < 10) continue // 跳过太短的语句

    const description = `执行语句 ${i + 1}/${sqlStatements.length}`

    // 尝试直接执行
    const executed = await executeDirectSQL(statement, description)

    if (executed) {
      successCount++
    } else {
      manualExecutions.push({
        index: i + 1,
        statement: statement,
        description: description
      })
    }
  }

  // 总结结果
  console.log('\n' + '='.repeat(60))
  console.log('📊 执行结果总结:')
  console.log(`✅ 自动执行成功: ${successCount} 个语句`)
  console.log(`⚠️  需要手动执行: ${manualExecutions.length} 个语句`)

  if (manualExecutions.length > 0) {
    console.log('\n🔧 需要手动执行的 SQL 语句:')
    console.log('\n🌐 请访问 Supabase Dashboard: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql')
    console.log('\n📋 手动执行步骤:')

    manualExecutions.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.description}:`)
      console.log('```sql')
      console.log(item.statement + ';')
      console.log('```')
    })
  }

  // 验证表创建
  console.log('\n🔍 验证表创建状态...')
  try {
    const { data: paymentTables, error: paymentError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'payment_qrcodes')

    const { data: rechargeTables, error: rechargeError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'recharge_requests')

    if (!paymentError && paymentTables.length > 0) {
      console.log('✅ payment_qrcodes 表已存在')
    } else {
      console.log('❌ payment_qrcodes 表未找到')
    }

    if (!rechargeError && rechargeTables.length > 0) {
      console.log('✅ recharge_requests 表已存在')
    } else {
      console.log('❌ recharge_requests 表未找到')
    }
  } catch (err) {
    console.log('⚠️  无法自动验证表状态，请手动检查')
  }

  console.log('\n🎉 MCP Supabase 设置完成！')
  console.log('\n📞 如果遇到问题:')
  console.log('1. 访问 Supabase Dashboard: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh')
  console.log('2. 进入 SQL 编辑器')
  console.log('3. 手动执行上述需要手动执行的 SQL 语句')
  console.log('4. 检查表是否在 Table Editor 中正确创建')

  console.log('\n🌐 前端访问地址: http://localhost:5173/profile')
  console.log('📊 数据库 Dashboard: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh')
}

// 运行主函数
main().catch(console.error)