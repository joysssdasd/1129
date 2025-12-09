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

        // 第一步：查找所有违规的帖子（view_count超过view_limit）
        const violatingPostsResponse = await fetch(
            `${supabaseUrl}/rest/v1/posts?view_count=gt.view_limit&status=eq.1&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const violatingPosts = await violatingPostsResponse.json();

        if (!violatingPosts || violatingPosts.length === 0) {
            return new Response(JSON.stringify({
                data: {
                    message: '没有发现违规数据',
                    count: 0,
                    details: '所有帖子的查看次数都在正常范围内'
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        let processedCount = 0;
        let totalRefundedPoints = 0;
        const cleanupLog = [];

        for (const post of violatingPosts) {
            try {
                const excessViews = post.view_count - post.view_limit;
                const refundPoints = Math.max(0, post.view_limit - post.view_count); // 确保不为负数

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
                                change_type: 6, // 数据清理退还
                                change_amount: refundPoints,
                                balance_after: newPoints,
                                related_id: post.id,
                                description: `数据清理退还积分（超出限制${excessViews}次）`
                            })
                        });
                        
                        totalRefundedPoints += refundPoints;
                    }
                }

                // 如果帖子已经超过查看限制，立即下架
                if (post.view_count > post.view_limit) {
                    await fetch(`${supabaseUrl}/rest/v1/posts?id=eq.${post.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status: 0 })
                    });
                } else if (post.view_count === post.view_limit) {
                    // 恰好达到限制，也下架以确保规则执行
                    await fetch(`${supabaseUrl}/rest/v1/posts?id=eq.${post.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status: 0 })
                    });
                }

                processedCount++;
                cleanupLog.push({
                    post_id: post.id,
                    title: post.title,
                    view_count: post.view_count,
                    view_limit: post.view_limit,
                    excess_views: excessViews,
                    refunded_points: refundPoints
                });

            } catch (e) {
                console.error(`处理违规帖子 ${post.id} 失败:`, e);
                cleanupLog.push({
                    post_id: post.id,
                    title: post.title,
                    error: e.message
                });
            }
        }

        // 第二步：修复过期但未下架的帖子
        const now = new Date().toISOString();
        const expiredPostsResponse = await fetch(
            `${supabaseUrl}/rest/v1/posts?status=eq.1&expire_at=lt.${now}&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const expiredPosts = await expiredPostsResponse.json();
        let expiredCount = 0;

        if (expiredPosts && expiredPosts.length > 0) {
            for (const post of expiredPosts) {
                try {
                    const remainingViews = Math.max(0, post.view_limit - post.view_count);
                    const refundPoints = remainingViews;

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
                                    description: `自动下架退还积分（剩余${remainingViews}次查看机会）`
                                })
                            });
                            
                            totalRefundedPoints += refundPoints;
                        }
                    }

                    // 下架过期信息
                    await fetch(`${supabaseUrl}/rest/v1/posts?id=eq.${post.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status: 0 })
                    });

                    expiredCount++;
                } catch (e) {
                    console.error(`处理过期帖子 ${post.id} 失败:`, e);
                }
            }
        }

        return new Response(JSON.stringify({
            data: {
                message: '数据清理完成',
                summary: {
                    violating_count: processedCount,
                    expired_count: expiredCount,
                    total_refunded_points: totalRefundedPoints,
                    total_processed: processedCount + expiredCount
                },
                violating_details: cleanupLog,
                timestamp: new Date().toISOString()
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('数据清理错误:', error);

        const errorResponse = {
            error: {
                code: 'EMERGENCY_CLEANUP_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});