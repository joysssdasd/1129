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
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 查找创建时间超过72小时但仍然上架的信息
        const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
        
        const expiredPostsResponse = await fetch(
            `${supabaseUrl}/rest/v1/posts?status=eq.1&created_at=lt.${seventyTwoHoursAgo}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const expiredPosts = await expiredPostsResponse.json();

        if (!expiredPosts || expiredPosts.length === 0) {
            return new Response(JSON.stringify({
                data: {
                    message: '没有找到超过72小时的过期信息',
                    count: 0
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        let processedCount = 0;
        const results = [];

        for (const post of expiredPosts) {
            try {
                // 计算剩余查看次数对应的积分
                const remainingViews = post.view_limit - post.view_count;
                const refundPoints = remainingViews; // 每次查看1积分

                if (refundPoints > 0) {
                    // 查询用户当前积分
                    const userResponse = await fetch(
                        `${supabaseUrl}/rest/v1/users?id=eq.${post.user_id}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey
                            }
                        }
                    );

                    const users = await userResponse.json();
                    
                    if (users && users.length > 0) {
                        const user = users[0];
                        const newPoints = user.points + refundPoints;

                        // 退还积分
                        await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${post.user_id}`, {
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
                                user_id: post.user_id,
                                change_type: 5, // 退还
                                change_amount: refundPoints,
                                balance_after: newPoints,
                                related_id: post.id,
                                description: `手动下架过期信息返还积分（剩余${remainingViews}次查看机会）`
                            })
                        });
                    }
                }

                // 更新信息状态为下架
                await fetch(`${supabaseUrl}/rest/v1/posts?id=eq.${post.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: 0 })
                });

                processedCount++;
                results.push({
                    id: post.id,
                    title: post.title,
                    created_at: post.created_at,
                    refund_points: refundPoints
                });

            } catch (e) {
                console.error(`处理过期信息 ${post.id} 失败:`, e);
            }
        }

        return new Response(JSON.stringify({
            data: {
                message: `成功下架${processedCount}条超过72小时的过期信息`,
                count: processedCount,
                results: results
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('手动下架过期信息错误:', error);

        const errorResponse = {
            error: {
                code: 'MANUAL_EXPIRE_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});