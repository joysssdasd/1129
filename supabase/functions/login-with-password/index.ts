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
        const { phone, password } = await req.json();

        if (!phone || !password) {
            throw new Error('请填写完整信息');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
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
            throw new Error('手机号或密码错误');
        }

        const user = users[0];

        // 检查用户状态
        if (user.status === 0) {
            throw new Error('账号已被禁用，请联系管理员');
        }

        // 管理员禁止使用密码登录
        if (user.role === 'admin' || user.is_admin === true) {
            throw new Error('管理员账号请使用验证码登录');
        }

        // 检查密码是否设置
        if (!user.password) {
            throw new Error('账号未设置密码，请使用验证码登录');
        }

        // 验证密码
        const passwordMatch = await verifyPassword(password, user.password);
        
        if (!passwordMatch) {
            throw new Error('手机号或密码错误');
        }

        // 不返回密码字段
        const { password: _, ...userWithoutPassword } = user;

        return new Response(JSON.stringify({
            data: {
                user: userWithoutPassword,
                message: '登录成功'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('密码登录错误:', error);

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

// 使用Web Crypto API验证密码
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
        // 从存储的哈希中提取salt
        const parts = hashedPassword.split(':');
        if (parts.length !== 2) {
            return false;
        }
        
        const salt = parts[0];
        const storedHash = parts[1];
        
        // 使用相同的salt计算新密码的哈希
        const newHash = await hashPassword(password, salt);
        
        // 比较两个哈希值
        return newHash === hashedPassword;
    } catch (error) {
        console.error('密码验证错误:', error);
        return false;
    }
}

// 使用Web Crypto API创建密码哈希
async function hashPassword(password: string, salt?: string): Promise<string> {
    // 如果没有提供salt，生成新的salt
    if (!salt) {
        const saltArray = new Uint8Array(16);
        crypto.getRandomValues(saltArray);
        salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
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
