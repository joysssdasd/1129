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

        // 查询用户信息
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

        // 检查积分是否足够
        if (user.points < 1) {
            throw new Error('积分不足，请先充值');
        }

        // 查询交易信息
        const postResponse = await fetch(
            `${supabaseUrl}/rest/v1/posts?id=eq.${post_id}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const posts = await postResponse.json();
        
        if (!posts || posts.length === 0) {
            throw new Error('交易信息不存在');
        }

        const post = posts[0];

        // 检查信息是否已下架
        if (post.status === 0) {
            throw new Error('该信息已下架');
        }

        // 检查剩余查看次数（优先级：无论是否查看过，都要检查总次数限制）
        if (post.view_count >= post.view_limit) {
            throw new Error('该信息查看次数已用完');
        }

        // 检查是否已经查看过
        const historyResponse = await fetch(
            `${supabaseUrl}/rest/v1/view_history?user_id=eq.${user_id}&post_id=eq.${post_id}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const histories = await historyResponse.json();
        
        if (histories && histories.length > 0) {
            // 已经查看过，但未超过总次数限制，允许免费再次查看
            // 更新查看历史的时间戳，确保最新查看的排在前面
            await fetch(`${supabaseUrl}/rest/v1/view_history?id=eq.${histories[0].id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ viewed_at: new Date().toISOString() })
            });
            
            const postOwnerResponse = await fetch(
                `${supabaseUrl}/rest/v1/users?id=eq.${post.user_id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                }
            );

            const postOwners = await postOwnerResponse.json();
            const wechatId = postOwners[0]?.wechat_id || '';

            return new Response(JSON.stringify({
                data: {
                    wechat_id: wechatId,
                    already_viewed: true,
                    message: '您已经查看过该联系方式'
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 查询发布者微信号
        const postOwnerResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${post.user_id}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const postOwners = await postOwnerResponse.json();
        
        if (!postOwners || postOwners.length === 0) {
            throw new Error('发布者不存在');
        }

        const wechatId = postOwners[0].wechat_id;

        // 扣除积分
        const newPoints = user.points - 1;
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
                change_type: 3, // 查看
                change_amount: -1,
                balance_after: newPoints,
                related_id: post_id,
                description: '查看联系方式'
            })
        });

        // 获取当前最新view_count以避免竞态条件
        const latestPostResponse = await fetch(
            `${supabaseUrl}/rest/v1/posts?id=eq.${post_id}&select=view_count,view_limit`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        const latestPosts = await latestPostResponse.json();
        const latestPost = latestPosts[0];
        const currentViewCount = latestPost.view_count;
        const newViewCount = currentViewCount + 1;

        // 最终检查：确保在增加后仍然符合限制
        if (newViewCount > latestPost.view_limit) {
            throw new Error('该信息查看次数已用完');
        }

        // 更新查看次数
        await fetch(`${supabaseUrl}/rest/v1/posts?id=eq.${post_id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ view_count: newViewCount })
        });

        // 记录查看历史
        await fetch(`${supabaseUrl}/rest/v1/view_history`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id,
                post_id,
                is_deal_confirmed: null
            })
        });

        return new Response(JSON.stringify({
            data: {
                wechat_id: wechatId,
                already_viewed: false,
                message: '查看成功'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('查看联系方式错误:', error);

        const errorResponse = {
            error: {
                code: 'VIEW_CONTACT_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
