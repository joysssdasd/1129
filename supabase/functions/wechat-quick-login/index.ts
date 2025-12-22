// 微信小程序一键登录 - 通过手机号授权
Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { code, inviteCode } = await req.json();

        if (!code) {
            throw new Error('缺少授权码');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const appId = Deno.env.get('WECHAT_MINIPROGRAM_APPID');
        const appSecret = Deno.env.get('WECHAT_MINIPROGRAM_SECRET');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('系统配置错误');
        }

        if (!appId || !appSecret) {
            throw new Error('微信小程序配置缺失，请联系管理员');
        }

        // 1. 获取 access_token
        const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();

        if (tokenData.errcode) {
            console.error('获取 access_token 失败:', tokenData);
            throw new Error(`微信接口错误: ${tokenData.errmsg}`);
        }

        const accessToken = tokenData.access_token;

        // 2. 使用 code 获取手机号
        const phoneUrl = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
        const phoneRes = await fetch(phoneUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const phoneData = await phoneRes.json();

        if (phoneData.errcode !== 0) {
            console.error('获取手机号失败:', phoneData);
            throw new Error(`获取手机号失败: ${phoneData.errmsg}`);
        }

        const phone = phoneData.phone_info.purePhoneNumber;

        // 3. 查找或创建用户
        const existingUserRes = await fetch(
            `${supabaseUrl}/rest/v1/users?phone=eq.${phone}&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            }
        );

        const existingUsers = await existingUserRes.json();
        let user;
        let isNewUser = false;

        if (existingUsers && existingUsers.length > 0) {
            // 更新现有用户
            user = existingUsers[0];
            
            // 如果 wechat_id 为空，设置为手机号
            const updateData: Record<string, unknown> = {
                last_login_at: new Date().toISOString(),
                last_login_ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
            };
            
            if (!user.wechat_id) {
                updateData.wechat_id = phone;
            }

            await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });

            // 重新获取更新后的用户信息
            const updatedUserRes = await fetch(
                `${supabaseUrl}/rest/v1/users?id=eq.${user.id}&select=*`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                    }
                }
            );
            const updatedUsers = await updatedUserRes.json();
            user = updatedUsers[0];

        } else {
            // 创建新用户
            isNewUser = true;
            const inviteCodeStr = `INV${Date.now().toString(36).toUpperCase()}`;
            
            const newUserData = {
                phone,
                wechat_id: phone, // 使用手机号作为联系方式
                invite_code: inviteCodeStr,
                invited_by: inviteCode || null,
                points: 100, // 新用户赠送100积分
                register_ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
                last_login_ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
                last_login_at: new Date().toISOString()
            };

            const createUserRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(newUserData)
            });

            if (!createUserRes.ok) {
                const errorText = await createUserRes.text();
                throw new Error(`创建用户失败: ${errorText}`);
            }

            const newUsers = await createUserRes.json();
            user = newUsers[0];

            // 记录新用户积分
            await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.id,
                    change_type: 0, // 注册赠送
                    change_amount: 100,
                    balance_after: 100,
                    description: '新用户注册赠送'
                })
            });

            // 处理邀请奖励
            if (inviteCode) {
                try {
                    await fetch(`${supabaseUrl}/functions/v1/process-referral-reward`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            inviterCode: inviteCode,
                            newUserId: user.id
                        })
                    });
                } catch (e) {
                    console.error('处理邀请奖励失败:', e);
                }
            }
        }

        return new Response(JSON.stringify({
            data: {
                user,
                isNewUser,
                message: isNewUser ? '注册成功，赠送100积分！' : '登录成功'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('微信登录错误:', error);
        return new Response(JSON.stringify({
            error: {
                code: 'WECHAT_LOGIN_ERROR',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
