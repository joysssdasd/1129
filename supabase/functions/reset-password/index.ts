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
        const { phone, verification_code, new_password } = await req.json();

        if (!phone || !verification_code || !new_password) {
            throw new Error('请填写完整信息');
        }

        // 验证新密码强度
        if (new_password.length < 6) {
            throw new Error('密码至少需要6位');
        }

        if (!/\d/.test(new_password) || !/[a-zA-Z]/.test(new_password)) {
            throw new Error('密码必须包含数字和字母');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 验证验证码
        const codeCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/verification_codes?phone=eq.${phone}&code=eq.${verification_code}&used=eq.false&expires_at=gte.${new Date().toISOString()}&order=created_at.desc&limit=1`,
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

        const users = await userCheckResponse.json();
        
        if (!users || users.length === 0) {
            throw new Error('该手机号未注册');
        }

        const user = users[0];

        // 加密新密码
        const hashedPassword = await hashPassword(new_password);

        // 更新密码
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                password: hashedPassword
            })
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`密码重置失败: ${errorText}`);
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
                success: true,
                message: '密码重置成功'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('重置密码错误:', error);

        const errorResponse = {
            error: {
                code: 'RESET_PASSWORD_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// 使用Web Crypto API创建密码哈希
async function hashPassword(password: string): Promise<string> {
    // 生成随机salt
    const saltArray = new Uint8Array(16);
    crypto.getRandomValues(saltArray);
    const salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 将密码和salt合并
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    
    // 使用SHA-256计算哈希
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 返回格式: salt:hash
    return `${salt}:${hashHex}`;
}
