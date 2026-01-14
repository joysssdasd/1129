// 修复 Supabase cron job 脚本
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hntiihuxqlklpiyqmlob.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudGlpaHV4cWxrbHBpeXFtbG9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTgxODY2MCwiZXhwIjoyMDUxMzk0NjYwfQ.3dyXS1VVgTrNflXmPFfP0hLBeszt4MxlFwkCYoNLqME';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixCronJob() {
  console.log('开始修复 cron job...\n');

  // 1. 检查当前 cron jobs
  console.log('1. 检查当前 cron jobs...');
  const { data: cronJobs, error: cronError } = await supabase.rpc('get_cron_jobs');

  if (cronError) {
    console.log('无法通过 RPC 获取 cron jobs，尝试直接查询...');

    // 尝试直接执行 SQL
    const { data, error } = await supabase.from('cron.job').select('*');
    if (error) {
      console.log('cron.job 表不可直接访问，需要通过 Dashboard 执行 SQL');
    } else {
      console.log('当前 cron jobs:', data);
    }
  } else {
    console.log('当前 cron jobs:', cronJobs);
  }

  // 2. 测试 auto-expire-posts Edge Function
  console.log('\n2. 测试 auto-expire-posts Edge Function...');
  try {
    const { data, error } = await supabase.functions.invoke('auto-expire-posts', {
      body: { source: 'manual-test' }
    });

    if (error) {
      console.log('Edge Function 调用失败:', error.message);
    } else {
      console.log('Edge Function 调用成功:', data);
    }
  } catch (e) {
    console.log('Edge Function 调用异常:', e.message);
  }

  // 3. 检查过期帖子
  console.log('\n3. 检查过期帖子...');
  const now = new Date().toISOString();
  const { data: expiredPosts, error: postsError } = await supabase
    .from('posts')
    .select('id, title, expire_at, status')
    .eq('status', 1)
    .lt('expire_at', now);

  if (postsError) {
    console.log('查询过期帖子失败:', postsError.message);
  } else {
    console.log(`发现 ${expiredPosts?.length || 0} 条过期但未下架的帖子`);
    if (expiredPosts && expiredPosts.length > 0) {
      expiredPosts.forEach(post => {
        console.log(`  - ID: ${post.id}, 标题: ${post.title}, 过期时间: ${post.expire_at}`);
      });
    }
  }

  console.log('\n修复检查完成！');
  console.log('\n=== 手动修复步骤 ===');
  console.log('请在 Supabase Dashboard (https://supabase.com/dashboard) 中执行以下操作：');
  console.log('1. 进入项目 -> Database -> Extensions，确保 pg_cron 和 pg_net 已启用');
  console.log('2. 进入 SQL Editor，执行 fix_cron_job.sql 中的 SQL 语句');
}

fixCronJob().catch(console.error);
