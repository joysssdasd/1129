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
        const { phone, wechat_id, verification_code, invite_code } = await req.json();

        if (!phone || !wechat_id || !verification_code) {
            throw new Error('请填写完整信息');
        }

        // 验证微信号格式
        if (!/^[a-zA-Z0-9_-]{6,20}$/.test(wechat_id)) {
            throw new Error('微信号格式不正确（6-20位字母、数字、下划线、减号）');
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

        // 检查手机号是否已注册
        const userCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?phone=eq.${phone}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const existingUsers = await userCheckResponse.json();
        
        if (existingUsers && existingUsers.length > 0) {
            throw new Error('该手机号已注册');
        }

        // 生成唯一的邀请码（6位随机字符）
        const generateInviteCode = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };

        let userInviteCode = generateInviteCode();
        
        // 确保邀请码唯一
        let attempts = 0;
        while (attempts < 10) {
            const inviteCheckResponse = await fetch(
                `${supabaseUrl}/rest/v1/users?invite_code=eq.${userInviteCode}`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                }
            );
            
            const existingInvites = await inviteCheckResponse.json();
            if (!existingInvites || existingInvites.length === 0) {
                break;
            }
            
            userInviteCode = generateInviteCode();
            attempts++;
        }

        // 如果提供了邀请码，验证其有效性
        let inviterCode = null;
        if (invite_code) {
            const inviterCheckResponse = await fetch(
                `${supabaseUrl}/rest/v1/users?invite_code=eq.${invite_code}`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                }
            );
            
            const inviters = await inviterCheckResponse.json();
            if (inviters && inviters.length > 0) {
                inviterCode = invite_code;
            }
        }

        // 创建用户
        const createUserResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                phone,
                wechat_id,
                invite_code: userInviteCode,
                invited_by: inviterCode,
                points: 100,
                status: 1
            })
        });

        if (!createUserResponse.ok) {
            const errorText = await createUserResponse.text();
            throw new Error(`用户创建失败: ${errorText}`);
        }

        const newUser = await createUserResponse.json();
        const userId = newUser[0].id;

        // 记录注册奖励积分
        await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                change_type: 4, // 奖励
                change_amount: 100,
                balance_after: 100,
                description: '注册奖励'
            })
        });

        // 如果有邀请关系，创建邀请记录
        if (inviterCode) {
            await fetch(`${supabaseUrl}/rest/v1/invitations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inviter_code: inviterCode,
                    invitee_id: userId,
                    has_posted: false,
                    reward_sent: false
                })
            });
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
                user: newUser[0],
                message: '注册成功，已获得100积分'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('用户注册错误:', error);

        const errorResponse = {
            error: {
                code: 'REGISTER_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
