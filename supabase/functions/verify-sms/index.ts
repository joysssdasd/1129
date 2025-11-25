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
        const { phone, code } = await req.json();

        if (!phone || !code) {
            throw new Error('请填写完整信息');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 验证验证码
        const codeCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/verification_codes?phone=eq.${phone}&code=eq.${code}&used=eq.false&expires_at=gte.${new Date().toISOString()}&order=created_at.desc&limit=1`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const codes = await codeCheckResponse.json();
        
        if (!codes || codes.length === 0) {
            throw new Error('验证码无效或已过期');
        }

        // 标记验证码为已使用
        await fetch(`${supabaseUrl}/rest/v1/verification_codes?id=eq.${codes[0].id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ used: true })
        });

        return new Response(JSON.stringify({
            data: {
                verified: true,
                message: '验证成功'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('验证码验证错误:', error);

        const errorResponse = {
            error: {
                code: 'VERIFICATION_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
