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
        const body = await req.json();
        const { user_id, title, keywords, price, trade_type, delivery_date, delivery_days, extra_info, view_limit, category_id } = body;
        
        console.log('发布请求参数:', body);

        if (!user_id || !title || !keywords || price === undefined || !trade_type) {
            throw new Error('请填写完整信息');
        }

        // 验证交易类型（3=做多，4=做空 需要交割时间）
        if ((trade_type === 3 || trade_type === 4) && !delivery_date && !delivery_days) {
            throw new Error('做多/做空需要填写交割时间');
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

        // 计算发布消耗的积分（默认10，可自定义）
        const pointsCost = view_limit || 10;

        // 检查积分是否足够
        if (user.points < pointsCost) {
            throw new Error(`积分不足，需要${pointsCost}积分，当前${user.points}积分`);
        }

        // 计算到期时间（72小时后）
        const expireAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

        // 处理交割日期（支持 delivery_date 或 delivery_days）
        let finalDeliveryDate = delivery_date || null;
        if (!finalDeliveryDate && delivery_days) {
            // 如果传入的是天数，计算交割日期
            finalDeliveryDate = new Date(Date.now() + delivery_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }

        // 创建交易信息
        const createPostResponse = await fetch(`${supabaseUrl}/rest/v1/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                user_id,
                title,
                keywords,
                price,
                trade_type,
                delivery_date: finalDeliveryDate,
                extra_info: extra_info || null,
                view_limit: pointsCost,
                view_count: 0,
                deal_count: 0,
                status: 1,
                expire_at: expireAt,
                category_id: category_id || null
            })
        });

        if (!createPostResponse.ok) {
            const errorText = await createPostResponse.text();
            console.error('创建帖子失败:', errorText);
            throw new Error(`发布失败: ${errorText}`);
        }

        const newPost = await createPostResponse.json();
        const postId = newPost[0].id;

        // 扣除积分
        const newPoints = user.points - pointsCost;
        await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user_id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                points: newPoints,
                total_posts: (user.total_posts || 0) + 1
            })
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
                change_type: 2, // 发布
                change_amount: -pointsCost,
                balance_after: newPoints,
                related_id: postId,
                description: '发布交易信息'
            })
        });

        // 检查是否是首次发布，如果有邀请关系则发放奖励
        if ((user.total_posts || 0) === 0) {
            const invitationResponse = await fetch(
                `${supabaseUrl}/rest/v1/invitations?invitee_id=eq.${user_id}&has_posted=eq.false`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                }
            );

            const invitations = await invitationResponse.json();
            
            if (invitations && invitations.length > 0) {
                const invitation = invitations[0];
                
                // 查询邀请人
                const inviterResponse = await fetch(
                    `${supabaseUrl}/rest/v1/users?invite_code=eq.${invitation.inviter_code}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey
                        }
                    }
                );

                const inviters = await inviterResponse.json();
                
                if (inviters && inviters.length > 0) {
                    const inviter = inviters[0];
                    
                    // 给邀请人增加10积分
                    const inviterNewPoints = inviter.points + 10;
                    await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${inviter.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            points: inviterNewPoints,
                            total_invites: (inviter.total_invites || 0) + 1
                        })
                    });

                    // 记录邀请人积分变动
                    await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            user_id: inviter.id,
                            change_type: 4, // 奖励
                            change_amount: 10,
                            balance_after: inviterNewPoints,
                            description: '邀请好友奖励'
                        })
                    });

                    // 给被邀请人增加30积分
                    const inviteeNewPoints = newPoints + 30;
                    await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user_id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ points: inviteeNewPoints })
                    });

                    // 记录被邀请人积分变动
                    await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            user_id,
                            change_type: 4, // 奖励
                            change_amount: 30,
                            balance_after: inviteeNewPoints,
                            description: '被邀请奖励'
                        })
                    });

                    // 更新邀请记录
                    await fetch(`${supabaseUrl}/rest/v1/invitations?id=eq.${invitation.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            has_posted: true,
                            reward_sent: true,
                            completed_at: new Date().toISOString()
                        })
                    });
                }
            }
        }

        return new Response(JSON.stringify({
            data: {
                post: newPost[0],
                message: '发布成功'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('发布交易信息错误:', error);

        const errorResponse = {
            error: {
                code: 'PUBLISH_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
