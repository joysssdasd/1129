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
        const { phone, old_password, new_password } = await req.json();

        if (!phone || !old_password || !new_password) {
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
            throw new Error('用户不存在');
        }

        const user = users[0];

        // 验证旧密码
        if (!user.password) {
            throw new Error('账号未设置密码');
        }

        const passwordMatch = await verifyPassword(old_password, user.password);
        
        if (!passwordMatch) {
            throw new Error('原密码错误');
        }

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
            throw new Error(`密码修改失败: ${errorText}`);
        }

        return new Response(JSON.stringify({
            data: {
                success: true,
                message: '密码修改成功'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('修改密码错误:', error);

        const errorResponse = {
            error: {
                code: 'CHANGE_PASSWORD_FAILED',
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
        const parts = hashedPassword.split(':');
        if (parts.length !== 2) {
            return false;
        }
        
        const salt = parts[0];
        const storedHash = parts[1];
        
        const newHash = await hashPassword(password, salt);
        
        return newHash === hashedPassword;
    } catch (error) {
        console.error('密码验证错误:', error);
        return false;
    }
}

// 使用Web Crypto API创建密码哈希
async function hashPassword(password: string, salt?: string): Promise<string> {
    if (!salt) {
        const saltArray = new Uint8Array(16);
        crypto.getRandomValues(saltArray);
        salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `${salt}:${hashHex}`;
}
