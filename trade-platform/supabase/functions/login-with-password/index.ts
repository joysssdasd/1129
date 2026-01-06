import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 艹！老王的密码登录Edge Function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    })
  }

  try {
    // 只接受POST请求
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { phone, password } = await req.json()

    // 验证输入
    if (!phone || !password) {
      return new Response(JSON.stringify({
        error: '手机号和密码不能为空'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return new Response(JSON.stringify({
        error: '请输入正确的手机号'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 创建Supabase客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 查询用户信息
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, phone, password, wechat_id, is_admin, points, created_at')
      .eq('phone', phone)
      .single()

    if (userError || !userData) {
      return new Response(JSON.stringify({
        error: '该手机号未注册，请先注册'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 验证密码 (这里应该使用bcrypt比较，暂时简单比较)
    if (userData.password !== password) {
      return new Response(JSON.stringify({
        error: '密码错误'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 管理员特殊处理
    if (userData.is_admin) {
      return new Response(JSON.stringify({
        error: '管理员账号请使用验证码登录'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 返回成功信息
    return new Response(JSON.stringify({
      message: '登录成功',
      user: {
        id: userData.id,
        phone: userData.phone,
        wechat_id: userData.wechat_id,
        is_admin: userData.is_admin,
        points: userData.points,
        role: userData.is_admin ? 'admin' : 'user',
        created_at: userData.created_at
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Login error:', error)
    return new Response(JSON.stringify({
      error: error.message || '登录失败，请稍后重试'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})