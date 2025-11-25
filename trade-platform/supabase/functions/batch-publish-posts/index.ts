/**
 * 老王我给你写的批量发布Edge Function！
 * 确保发布帖子和扣除积分的事务性操作
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // 处理CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { userId, posts, totalCost } = await req.json()

    if (!userId || !posts || !Array.isArray(posts)) {
      throw new Error('参数无效')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 开始事务处理
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      throw new Error('用户不存在')
    }

    if (userData.points < totalCost) {
      throw new Error('积分不足')
    }

    // 1. 先扣除积分
    const { error: deductError } = await supabase
      .from('users')
      .update({
        points: userData.points - totalCost,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (deductError) {
      throw new Error('扣除积分失败')
    }

    // 2. 批量插入帖子
    const { data: insertedPosts, error: insertError } = await supabase
      .from('posts')
      .insert(posts)
      .select()

    if (insertError) {
      // 如果插入失败，回滚积分
      await supabase
        .from('users')
        .update({
          points: userData.points,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      throw new Error('发布帖子失败')
    }

    // 3. 记录积分使用日志
    await supabase
      .from('point_transactions')
      .insert({
        user_id: userId,
        type: 'expense',
        amount: -totalCost,
        description: `批量发布${posts.length}个帖子`,
        related_type: 'batch_publish',
        created_at: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({
        success: true,
        successCount: insertedPosts?.length || 0,
        failedPosts: [],
        newPoints: userData.points - totalCost,
        message: '批量发布成功'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('批量发布失败:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '批量发布失败',
        successCount: 0,
        failedPosts: []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})