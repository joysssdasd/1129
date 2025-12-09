import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// 艹！老王的发送验证码Edge Function
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

    const { phone } = await req.json()

    // 验证输入
    if (!phone) {
      return new Response(JSON.stringify({
        error: '手机号不能为空'
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

    // 生成6位随机验证码
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    console.log(`验证码已发送到 ${phone}: ${verificationCode}`)

    // 实际应用中这里应该调用短信API发送验证码
    // 这里我们暂时在控制台输出，方便测试

    return new Response(JSON.stringify({
      message: '验证码已发送，请注意查收',
      verification_code: verificationCode, // 开发环境返回验证码，生产环境应该删除
      code: verificationCode
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Send verification code error:', error)
    return new Response(JSON.stringify({
      error: error.message || '发送失败'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})