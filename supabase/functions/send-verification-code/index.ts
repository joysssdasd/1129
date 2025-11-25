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
        // 首先获取环境变量
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        const { phone } = await req.json();

        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
            throw new Error('手机号格式不正确');
        }

        // 生成6位随机验证码
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 设置验证码有效期（5分钟）
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        // 检查该手机号最近1小时内的尝试次数
        const checkResponse = await fetch(
            `${supabaseUrl}/rest/v1/verification_codes?phone=eq.${phone}&created_at=gte.${new Date(Date.now() - 60 * 60 * 1000).toISOString()}&select=attempts`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const existingCodes = await checkResponse.json();
        const totalAttempts = existingCodes.reduce((sum: number, item: any) => sum + (item.attempts || 0), 0);

        if (totalAttempts >= 3) {
            throw new Error('验证码发送次数过多，请1小时后再试');
        }

        // 调用spug短信服务发送验证码
        // 按照官方文档格式： https://push.spug.cc/guide/sms-code
        const smsUrl = 'https://push.spug.cc/send/Xyd9M8AlV5rKbDBk';
        const smsPayload = {
            name: '推送助手',      // 消息名称
            code: code,           // 验证码内容
            targets: phone        // 目标手机号
        };

        console.log('发送短信请求:', JSON.stringify(smsPayload));

        let smsSuccess = false;
        let smsErrorMessage = '';

        try {
            const smsResponse = await fetch(smsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(smsPayload)
            });

            const smsResult = await smsResponse.json();
            console.log('短信服务响应:', JSON.stringify(smsResult));

            if (smsResponse.ok && smsResult.code === 200) {
                smsSuccess = true;
                console.log('短信发送成功');
            } else {
                smsErrorMessage = smsResult.message || '短信发送失败';
                console.error('短信发送失败:', smsErrorMessage);
                console.error('完整响应:', JSON.stringify(smsResult));
            }
        } catch (e) {
            smsErrorMessage = e.message || '短信服务异常';
            console.error('短信服务异常:', e);
        }

        // 存储验证码到数据库
        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/verification_codes`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                phone,
                code,
                expires_at: expiresAt,
                used: false,
                attempts: 0
            })
        });

        if (!insertResponse.ok) {
            const errorText = await insertResponse.text();
            throw new Error(`验证码生成失败: ${errorText}`);
        }

        console.log(`验证码已生成并存储: 手机号 ${phone}, 验证码 ${code}`);

        // 返回成功，但提示短信发送状态
        const responseMessage = smsSuccess 
            ? '验证码已发送，请注意查收' 
            : `验证码已生成，但短信发送失败: ${smsErrorMessage}。请联系管理员或稍后重试。`;

        return new Response(JSON.stringify({
            data: {
                success: true,
                message: responseMessage,
                smsStatus: smsSuccess ? 'sent' : 'failed',
                debugInfo: smsSuccess ? undefined : { error: smsErrorMessage }
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('发送验证码错误:', error);

        const errorResponse = {
            error: {
                code: 'SEND_CODE_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
