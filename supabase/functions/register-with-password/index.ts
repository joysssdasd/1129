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
        const { phone, password, wechat_id, invite_code } = await req.json();

        if (!phone || !password || !wechat_id) {
            throw new Error('请填写完整信息');
        }

        // 验证密码强度
        if (password.length < 6) {
            throw new Error('密码至少需要6位');
        }

        if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
            throw new Error('密码必须包含数字和字母');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 检查手机号是否已存在
        const phoneCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?phone=eq.${phone}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const existingUsers = await phoneCheckResponse.json();
        if (existingUsers && existingUsers.length > 0) {
            throw new Error('该手机号已注册');
        }

        // 生成邀请码
        const userInviteCode = generateInviteCode();

        // 处理邀请关系
        let invitedBy = null;
        if (invite_code) {
            const inviterResponse = await fetch(
                `${supabaseUrl}/rest/v1/users?invite_code=eq.${invite_code}`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                }
            );

            const inviters = await inviterResponse.json();
            if (inviters && inviters.length > 0) {
                invitedBy = invite_code;
            }
        }

        // 加密密码
        const hashedPassword = await hashPassword(password);

        // 创建用户 (base 100 points + 30 bonus if invited = 130 total)
        const basePoints = 100;
        const inviteeBonus = invitedBy ? 30 : 0;
        const totalPoints = basePoints + inviteeBonus;

        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                phone,
                password: hashedPassword,
                wechat_id,
                invite_code: userInviteCode,
                invited_by: invitedBy,
                points: totalPoints,
                status: 1
            })
        });

        if (!insertResponse.ok) {
            const errorText = await insertResponse.text();
            throw new Error(`注册失败: ${errorText}`);
        }

        const users = await insertResponse.json();
        const newUser = users[0];

        // 记录注册赠送的积分
        await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: newUser.id,
                change_type: 1,
                change_amount: basePoints,
                description: 'Registration bonus'
            })
        });

        // If invited, record bonus points for invitee
        if (inviteeBonus > 0) {
            await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: newUser.id,
                    change_type: 4,
                    change_amount: inviteeBonus,
                    description: 'New user registration reward (invited)'
                })
            });
        }

        // 如果有邀请人，给邀请人增加积分 (10 points)
        if (invitedBy) {
            const inviterResponse = await fetch(
                `${supabaseUrl}/rest/v1/users?invite_code=eq.${invitedBy}`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                }
            );

            const inviters = await inviterResponse.json();
            if (inviters && inviters.length > 0) {
                const inviter = inviters[0];
                const inviterReward = 10;
                const newPoints = inviter.points + inviterReward;
                const newInvites = (inviter.total_invites || 0) + 1;

                // 更新邀请人积分和邀请数
                await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${inviter.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        points: newPoints,
                        total_invites: newInvites
                    })
                });

                // 记录邀请人的积分变动
                await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: inviter.id,
                        change_type: 4,
                        change_amount: inviterReward,
                        description: `Invite new user reward`
                    })
                });

                // 记录邀请关系
                await fetch(`${supabaseUrl}/rest/v1/invitations`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        inviter_code: invitedBy,
                        invitee_id: newUser.id,
                        has_posted: false,
                        reward_sent: true,
                        completed_at: new Date().toISOString()
                    })
                });
            }
        }

        // 不返回密码字段
        const { password: _, ...userWithoutPassword } = newUser;

        return new Response(JSON.stringify({
            data: {
                user: userWithoutPassword,
                message: '注册成功'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('注册错误:', error);

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

// 生成6位邀请码
function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

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
