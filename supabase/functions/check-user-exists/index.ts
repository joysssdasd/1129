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
        const { phone } = await req.json();
        console.log('检查用户是否存在:', phone);

        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
            throw new Error('手机号格式不正确');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 使用 service role key 查询用户
        const userCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?phone=eq.${phone}&select=phone,is_admin`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        if (!userCheckResponse.ok) {
            const errorText = await userCheckResponse.text();
            console.error('用户查询失败:', errorText);
            throw new Error('查询失败');
        }

        const users = await userCheckResponse.json();
        console.log('查询结果:', users);

        const exists = users && users.length > 0;
        const isAdmin = exists && users[0].is_admin === true;

        return new Response(JSON.stringify({
            data: {
                exists,
                isAdmin,
                phone
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('检查用户错误:', error);

        return new Response(JSON.stringify({
            error: {
                code: 'CHECK_USER_FAILED',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
