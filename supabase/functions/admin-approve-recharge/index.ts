const PRESET_PACKAGES: Record<number, { points: number; name: string }> = {
    50: { points: 55, name: '充值套餐A' },
    100: { points: 115, name: '充值套餐B' },
    300: { points: 370, name: '充值套餐C' },
    500: { points: 650, name: '充值套餐D' }
};

function getPackageName(amount: number, points: number) {
    const preset = PRESET_PACKAGES[amount];
    if (preset && preset.points === points) {
        return preset.name;
    }
    return '自定义充值';
}

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
        const { admin_id, request_id, approved, admin_note } = await req.json();

        if (!admin_id || !request_id || approved === undefined) {
            throw new Error('缺少必要参数');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        const adminResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${admin_id}&is_admin=eq.true`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const admins = await adminResponse.json();
        
        if (!admins || admins.length === 0) {
            throw new Error('无管理员权限');
        }

        const requestResponse = await fetch(
            `${supabaseUrl}/rest/v1/recharge_requests?id=eq.${request_id}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const requests = await requestResponse.json();
        
        if (!requests || requests.length === 0) {
            throw new Error('充值申请不存在');
        }

        const rechargeRequest = requests[0];

        if (rechargeRequest.status !== 0) {
            throw new Error('该申请已处理');
        }

        if (approved) {
            const userResponse = await fetch(
                `${supabaseUrl}/rest/v1/users?id=eq.${rechargeRequest.user_id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                }
            );

            const users = await userResponse.json();
            
            if (!users || users.length === 0) {
                throw new Error('用户不存在');
            }

            const user = users[0];
            const newPoints = user.points + rechargeRequest.points;

            await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${rechargeRequest.user_id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ points: newPoints })
            });

            const packageName = getPackageName(
                Number(rechargeRequest.amount),
                Number(rechargeRequest.points)
            );

            await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: rechargeRequest.user_id,
                    change_type: 1,
                    change_amount: rechargeRequest.points,
                    balance_after: newPoints,
                    related_id: request_id,
                    description: `充值${rechargeRequest.amount}元 (${packageName})`
                })
            });

            await fetch(`${supabaseUrl}/rest/v1/recharge_requests?id=eq.${request_id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 1,
                    admin_id,
                    admin_note: admin_note || '',
                    processed_at: new Date().toISOString()
                })
            });

            return new Response(JSON.stringify({
                data: {
                    message: '充值申请已通过，积分已到账'
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } else {
            await fetch(`${supabaseUrl}/rest/v1/recharge_requests?id=eq.${request_id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 2,
                    admin_id,
                    admin_note: admin_note || '',
                    processed_at: new Date().toISOString()
                })
            });

            return new Response(JSON.stringify({
                data: {
                    message: '充值申请已拒绝'
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        console.error('审核充值错误:', error);

        const errorResponse = {
            error: {
                code: 'APPROVE_RECHARGE_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
