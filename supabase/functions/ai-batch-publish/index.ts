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
        const { user_id, text_input, trade_type, contact_method } = await req.json();

        if (!user_id || !text_input) {
            throw new Error('缺少必要参数');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const deepseekApiKey = 'sk-4dac2f720dfc43a18dc3f46053a68f16';

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 验证管理员权限
        const adminResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${user_id}&is_admin=eq.true`,
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

        // 调用DeepSeek API解析文本
        const aiPrompt = `你是一个专业的票务信息解析助手。请将以下文本解析为结构化的票务交易信息列表。

文本内容：
${text_input}

【重要解析规则】：
1. 票档价格格式：位置-价格/位置-价格（如799-1100/1050表示799位置价格1100元，1050位置价格1199元）
2. 选择价格时，选择票档位置较小的价格作为主要价格
3. 标题提取：活动名称（如"上海梁静茹"）
4. 关键词包含：演出类型、演出城市、演出时间等

要求：
1. 识别出所有独立的票务交易信息
2. 每个交易信息包含：标题、价格、关键词（3-5个，逗号分隔）
3. 返回JSON数组格式
4. 价格需要是数字格式
5. 标题不超过30字

返回格式示例：
[
  {"title": "上海梁静茹", "price": 1100, "keywords": "梁静茹,演唱会,上海,11.15,799位置"},
  {"title": "成都周深", "price": 900, "keywords": "周深,演唱会,成都,11.16,包厢"}
]

【特别注意】：
- 对于"799-1100/1050"格式：799是座位位置，1100是该位置的价格
- 选择较低票档位置的价格作为主价格
- 提取具体的座位位置信息到关键词中

请直接返回JSON数组，不要添加任何其他文字。`;

        const aiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${deepseekApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'user', content: aiPrompt }
                ],
                temperature: 0.3
            })
        });

        if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`AI解析失败: ${errorText}`);
        }

        const aiResult = await aiResponse.json();
        const aiContent = aiResult.choices[0].message.content;

        // 解析AI返回的JSON
        let parsedPosts;
        try {
            // 尝试提取JSON数组
            const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                parsedPosts = JSON.parse(jsonMatch[0]);
            } else {
                parsedPosts = JSON.parse(aiContent);
            }
        } catch (e) {
            throw new Error(`AI返回内容解析失败: ${aiContent}`);
        }

        if (!Array.isArray(parsedPosts) || parsedPosts.length === 0) {
            throw new Error('未能解析出有效的交易信息');
        }

        // 批量创建交易信息
        const expireAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        const createdPosts = [];

        for (const post of parsedPosts) {
            try {
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
                        title: post.title.substring(0, 30),
                        keywords: post.keywords,
                        price: parseFloat(post.price),
                        trade_type: trade_type || 2, // 默认出售
                        view_limit: 10,
                        view_count: 0,
                        deal_count: 0,
                        status: 1,
                        expire_at: expireAt
                    })
                });

                if (createPostResponse.ok) {
                    const newPost = await createPostResponse.json();
                    createdPosts.push(newPost[0]);
                }
            } catch (e) {
                console.error('创建交易信息失败:', e);
            }
        }

        return new Response(JSON.stringify({
            data: {
                parsed_count: parsedPosts.length,
                created_count: createdPosts.length,
                posts: createdPosts,
                message: `成功解析${parsedPosts.length}条信息，创建${createdPosts.length}条`
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('AI批量发布错误:', error);

        const errorResponse = {
            error: {
                code: 'AI_BATCH_PUBLISH_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
