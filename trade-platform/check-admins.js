// 管理员账户检查和创建脚本
// 运行: node check-admins.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mgyelmyjeidlvmmmjkqi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1neWVsbXlqZWlkbHZtbW1qa3FpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjcwMjQwNiwiZXhwIjoyMDc4Mjc4NDA2fQ.AIvJb7JdwSlR1CBjG3M2RZryWi5JPCNOZ7Zd8LZ4GJo'
);

async function checkAndCreateAdmins() {
  const adminPhones = ['13011319329', '13001220766'];
  
  console.log('=== 检查管理员账户 ===');
  
  // 查询现有管理员
  const { data: existingUsers, error: queryError } = await supabase
    .from('users')
    .select('*')
    .in('phone', adminPhones);
  
  if (queryError) {
    console.log('查询错误:', queryError);
    return;
  }
  
  console.log('现有用户:', existingUsers);
  
  // 检查哪些管理员不存在
  const existingPhones = existingUsers?.map(u => u.phone) || [];
  const missingPhones = adminPhones.filter(p => !existingPhones.includes(p));
  
  console.log('缺失的管理员:', missingPhones);
  
  // 创建缺失的管理员
  for (const phone of missingPhones) {
    console.log(`创建管理员: ${phone}`);
    const { data, error } = await supabase
      .from('users')
      .insert({
        phone: phone,
        wechat_id: `admin_${phone}`,
        is_admin: true,
        points: 99999,
        status: 1
      })
      .select()
      .single();
    
    if (error) {
      console.log(`创建失败 ${phone}:`, error);
    } else {
      console.log(`创建成功:`, data);
    }
  }
  
  // 确保现有用户是管理员
  for (const user of existingUsers || []) {
    if (!user.is_admin) {
      console.log(`更新用户为管理员: ${user.phone}`);
      const { error } = await supabase
        .from('users')
        .update({ is_admin: true, points: 99999 })
        .eq('phone', user.phone);
      
      if (error) console.log('更新失败:', error);
      else console.log('更新成功');
    }
  }
  
  // 最终确认
  const { data: finalCheck } = await supabase
    .from('users')
    .select('phone, wechat_id, is_admin, points')
    .in('phone', adminPhones);
  
  console.log('\n=== 最终管理员状态 ===');
  console.log(finalCheck);
}

checkAndCreateAdmins();
