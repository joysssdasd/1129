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
        const { user_id, post_id } = await req.json();

        if (!user_id || !post_id) {
            throw new Error('缺少必要参数');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 查询交易信息
        const postResponse = await fetch(
            `${supabaseUrl}/rest/v1/posts?id=eq.${post_id}&user_id=eq.${user_id}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const posts = await postResponse.json();
        
        if (!posts || posts.length === 0) {
            throw new Error('交易信息不存在或无权操作');
        }

        const post = posts[0];
        const currentStatus = post.status;
        const newStatus = currentStatus === 1 ? 0 : 1;

        // 处理积分变动
        let pointsChange = 0;
        let operationMessage = '';
        
        // 获取用户当前积分
        const userResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${user_id}`,
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
        
        // 如果是下架操作（从1变为0），计算并返还积分
        if (currentStatus === 1 && newStatus === 0) {
            // 返还剩余可查看次数的积分
            const remainingViews = post.view_limit - post.view_count;
            pointsChange = remainingViews;
            
            if (pointsChange > 0) {
                const newPoints = user.points + pointsChange;

                // 更新用户积分
                await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user_id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ points: newPoints })
                });

                // 记录积分变动
                await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id,
                        change_type: 5, // 下架返还
                        change_amount: pointsChange,
                        balance_after: newPoints,
                        related_id: post_id,
                        description: `下架返还积分（剩余${pointsChange}次可查看）`
                    })
                });
                
                operationMessage = `已下架，返还${pointsChange}积分`;
            } else {
                operationMessage = '已下架';
            }
        }
        // 如果是上架操作（从0变为1），扣除10积分
        else if (currentStatus === 0 && newStatus === 1) {
            const deductPoints = 10;
            
            // 检查积分是否足够
            if (user.points < deductPoints) {
                throw new Error('积分不足，无法重新上架');
            }
            
            const newPoints = user.points - deductPoints;

            // 更新用户积分
            await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user_id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ points: newPoints })
            });

            // 记录积分变动
            await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id,
                    change_type: 6, // 重新上架扣除
                    change_amount: -deductPoints,
                    balance_after: newPoints,
                    related_id: post_id,
                    description: `重新上架扣除积分（${deductPoints}积分）`
                })
            });
            
            pointsChange = -deductPoints;
            operationMessage = `已上架，扣除${deductPoints}积分`;
        }

        // 更新交易信息状态
        await fetch(`${supabaseUrl}/rest/v1/posts?id=eq.${post_id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        return new Response(JSON.stringify({
            data: {
                new_status: newStatus,
                points_change: pointsChange,
                message: operationMessage || (newStatus === 1 ? '已上架' : '已下架')
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('切换状态错误:', error);

        const errorResponse = {
            error: {
                code: 'TOGGLE_STATUS_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
