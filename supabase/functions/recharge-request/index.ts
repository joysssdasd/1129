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
        const { user_id, amount, points, is_custom, screenshot_data } = await req.json();

        if (!user_id || !amount || !screenshot_data) {
            throw new Error('请填写完整信息并上传付款截图');
        }

        // 验证金额范围
        const amountNum = parseFloat(amount.toString());
        if (isNaN(amountNum) || amountNum < 1) {
            throw new Error('充值金额不能少于1元');
        }
        if (amountNum > 100000) {
            throw new Error('充值金额不能超过100000元');
        }

        // 计算积分
        let finalPoints: number;
        let packageName: string;

        if (is_custom) {
            // 自定义充值：1元=1积分
            finalPoints = Math.floor(amountNum);
            packageName = `自定义充值${amountNum}元`;
        } else {
            // 预设套餐
            const pointsMap: { [key: number]: { points: number, name: string } } = {
                50: { points: 55, name: '充值套餐A' },      // 赠送5积分
                100: { points: 115, name: '充值套餐B' },    // 赠送15积分
                300: { points: 370, name: '充值套餐C' },    // 赠送70积分
                500: { points: 650, name: '充值套餐D' }     // 赠送150积分
            };

            const packageInfo = pointsMap[amountNum];
            if (!packageInfo) {
                throw new Error('请选择有效的充值档位（50/100/300/500元）');
            }
            finalPoints = packageInfo.points;
            packageName = packageInfo.name;
        }

        // 如果传入了points参数，优先使用传入的值
        if (points !== undefined) {
            finalPoints = parseInt(points);
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 上传截图到存储桶
        const base64Data = screenshot_data.split(',')[1];
        const mimeType = screenshot_data.split(';')[0].split(':')[1];
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        const timestamp = Date.now();
        const storagePath = `${user_id}/${timestamp}.jpg`;

        const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/recharge-screenshots/${storagePath}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': mimeType,
                'x-upsert': 'true'
            },
            body: binaryData
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`截图上传失败: ${errorText}`);
        }

        const screenshotUrl = `${supabaseUrl}/storage/v1/object/public/recharge-screenshots/${storagePath}`;

        // 创建充值申请
        const createRequestResponse = await fetch(`${supabaseUrl}/rest/v1/recharge_requests`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                user_id,
                amount: amountNum,
                points: finalPoints,
                package_name: packageName,
                is_custom: is_custom || false,
                screenshot_url: screenshotUrl,
                status: 0 // 待审核
            })
        });

        if (!createRequestResponse.ok) {
            const errorText = await createRequestResponse.text();
            throw new Error(`充值申请提交失败: ${errorText}`);
        }

        const newRequest = await createRequestResponse.json();

        return new Response(JSON.stringify({
            data: {
                request: newRequest[0],
                message: '充值申请已提交，请等待管理员审核'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('充值申请错误:', error);

        const errorResponse = {
            error: {
                code: 'RECHARGE_REQUEST_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
