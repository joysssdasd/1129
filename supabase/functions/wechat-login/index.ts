// WeChat OAuth Login Handler
// Requires WeChat App credentials (WECHAT_APPID and WECHAT_APPSECRET)
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
        const { code, phone, deviceFingerprint, inviteCode } = await req.json();

        if (!code || !phone) {
            throw new Error('WeChat code and phone number are required');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const wechatAppId = Deno.env.get('WECHAT_APPID');
        const wechatAppSecret = Deno.env.get('WECHAT_APPSECRET');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase configuration missing');
        }

        if (!wechatAppId || !wechatAppSecret) {
            throw new Error('WeChat credentials not configured. Please contact administrator.');
        }

        // Exchange code for access token
        const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${wechatAppId}&secret=${wechatAppSecret}&code=${code}&grant_type=authorization_code`;
        
        const tokenResponse = await fetch(tokenUrl);
        const tokenData = await tokenResponse.json();

        if (tokenData.errcode) {
            throw new Error(`WeChat API error: ${tokenData.errmsg}`);
        }

        const { access_token, openid, unionid } = tokenData;

        // Get user info from WeChat
        const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`;
        
        const userInfoResponse = await fetch(userInfoUrl);
        const wechatUser = await userInfoResponse.json();

        if (wechatUser.errcode) {
            throw new Error(`WeChat user info error: ${wechatUser.errmsg}`);
        }

        // Check if user exists by wechat_openid or phone
        const existingUserResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?or=(wechat_openid.eq.${openid},phone.eq.${phone})&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            }
        );

        const existingUsers = await existingUserResponse.json();
        let user;

        if (existingUsers && existingUsers.length > 0) {
            // Update existing user
            user = existingUsers[0];
            
            await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    wechat_openid: openid,
                    wechat_unionid: unionid,
                    wechat_nickname: wechatUser.nickname,
                    wechat_avatar: wechatUser.headimgurl,
                    last_login_ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
                    last_login_at: new Date().toISOString()
                })
            });

        } else {
            // Create new user
            const inviteCodeStr = `INV${Date.now().toString(36).toUpperCase()}`;
            
            const newUserData = {
                phone,
                wechat_id: wechatUser.nickname || openid,
                wechat_openid: openid,
                wechat_unionid: unionid,
                wechat_nickname: wechatUser.nickname,
                wechat_avatar: wechatUser.headimgurl,
                invite_code: inviteCodeStr,
                invited_by: inviteCode || null,
                points: 100,
                device_fingerprint: deviceFingerprint,
                register_ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
                last_login_ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
                last_login_at: new Date().toISOString()
            };

            const createUserResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(newUserData)
            });

            const newUsers = await createUserResponse.json();
            user = newUsers[0];

            // Process referral if invite code provided
            if (inviteCode) {
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
            }
        }

        return new Response(JSON.stringify({
            data: {
                user,
                isNewUser: !existingUsers || existingUsers.length === 0
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('WeChat login error:', error);
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
