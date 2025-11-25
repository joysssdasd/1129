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
        const { payment_type, qr_code_url } = await req.json();

        if (!payment_type || !qr_code_url) {
            throw new Error('支付类型和二维码URL都是必填项');
        }

        if (!['wechat', 'alipay'].includes(payment_type)) {
            throw new Error('支付类型必须是wechat或alipay');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 检查是否已存在该类型的二维码
        const checkResponse = await fetch(
            `${supabaseUrl}/rest/v1/payment_qrcodes?payment_type=eq.${payment_type}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const existing = await checkResponse.json();

        let result;
        if (existing && existing.length > 0) {
            // 更新现有记录
            const updateResponse = await fetch(
                `${supabaseUrl}/rest/v1/payment_qrcodes?payment_type=eq.${payment_type}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        qr_code_url,
                        updated_at: new Date().toISOString()
                    })
                }
            );

            if (!updateResponse.ok) {
                throw new Error('更新二维码失败');
            }

            result = await updateResponse.json();
        } else {
            // 插入新记录
            const insertResponse = await fetch(
                `${supabaseUrl}/rest/v1/payment_qrcodes`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        payment_type,
                        qr_code_url
                    })
                }
            );

            if (!insertResponse.ok) {
                throw new Error('保存二维码失败');
            }

            result = await insertResponse.json();
        }

        return new Response(JSON.stringify({
            data: {
                qrcode: result[0],
                message: '二维码保存成功'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('保存二维码错误:', error);

        const errorResponse = {
            error: {
                code: 'SAVE_QRCODE_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
