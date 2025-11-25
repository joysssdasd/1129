Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { phone, verification_code } = await req.json();
        console.log('登录请求:', { phone, verification_code });

        if (!phone || !verification_code) {
            throw new Error('请填写完整信息');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        console.log('环境检查:', { 
            hasServiceKey: !!serviceRoleKey, 
            hasUrl: !!supabaseUrl,
            url: supabaseUrl 
        });

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 验证验证码
        const codeQuery = `phone=eq.${phone}&code=eq.${verification_code}&used=eq.false&expires_at=gte.${new Date().toISOString()}&order=created_at.desc&limit=1`;
        const codeCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/verification_codes?${codeQuery}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );
        console.log('验证码查询响应状态:', codeCheckResponse.status);

        if (!codeCheckResponse.ok) {
            const errorText = await codeCheckResponse.text();
            console.error('验证码查询失败:', errorText);
            throw new Error(`验证码查询失败: ${codeCheckResponse.status}`);
        }

        const codes = await codeCheckResponse.json();
        console.log('验证码查询结果:', codes);
        
        if (!codes || codes.length === 0) {
            throw new Error('验证码无效或已过期');
        }

        // 查询用户信息
        const userCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?phone=eq.${phone}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );
        console.log('用户查询响应状态:', userCheckResponse.status);

        if (!userCheckResponse.ok) {
            const errorText = await userCheckResponse.text();
            console.error('用户查询失败:', errorText);
            throw new Error(`用户查询失败: ${userCheckResponse.status}`);
        }

        const users = await userCheckResponse.json();
        console.log('用户查询结果:', users);
        
        if (!users || users.length === 0) {
            throw new Error('该手机号未注册');
        }

        const user = users[0];
        console.log('用户信息:', user);

        // 检查用户状态
        if (user.status === 0) {
            throw new Error('账号已被禁用，请联系管理员');
        }

        // 标记验证码为已使用
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/verification_codes?id=eq.${codes[0].id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ used: true })
        });
        console.log('验证码更新响应状态:', updateResponse.status);

        return new Response(JSON.stringify({
            data: {
                user,
                message: '登录成功'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('登录错误详情:', error);
        console.error('用户登录错误:', error);

        const errorResponse = {
            error: {
                code: 'LOGIN_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
