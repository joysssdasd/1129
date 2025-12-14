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
        const requestBody = await req.json();
        const { user_id, text_input, trade_type, wechat_id, step, drafts } = requestBody;

        if (!user_id) {
            throw new Error('缺少用户ID');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const deepseekApiKey = 'sk-4dac2f720dfc43a18dc3f46053a68f16';

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // Step 1: AI解析生成草稿
        if (step === 'parse') {
            if (!text_input) {
                throw new Error('缺少输入文本');
            }

            const prompt = `解析以下演唱会票务信息，返回JSON数组。

输入文本：
${text_input}

解析规则：
1. 第一行是基础信息，提取演出名称（如"成都周深"、"上海梁静茹"等城市+歌手名）
2. 后续每行格式为"票档的价格"，例如：
   - "399的900" → 票档=399, 价格=900
   - "包厢的1150" → 票档=包厢, 价格=1150
   - "1050-1199" → 票档=1050, 价格=1199（用-分隔时，前面是票档，后面是价格）
3. 生成标题 = 演出名称 + 票档，例如"成都周深399"
4. 价格 = "的"后面或"-"后面的数字

示例输入：
成都周深 2号邀请函代录
399的900
699的1000
包厢的1150

示例输出：
[
  {"title": "成都周深399", "price": 900},
  {"title": "成都周深699", "price": 1000},
  {"title": "成都周深包厢", "price": 1150}
]

只返回JSON数组，不要其他文字：`;

            const aiResponse = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${deepseekApiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: '你是一个票务信息解析助手。严格按照规则解析，只输出JSON数组。' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1
                })
            });

            if (!aiResponse.ok) {
                const errorText = await aiResponse.text();
                console.error('AI API错误:', errorText);
                throw new Error('AI解析服务暂时不可用');
            }

            const aiResult = await aiResponse.json();
            const content = aiResult.choices?.[0]?.message?.content || '[]';
            
            console.log('AI原始返回:', content);

            // 提取JSON数组
            let parsedItems: Array<{ title: string; price: number; description?: string; keywords?: string[] }> = [];
            try {
                // 尝试匹配JSON数组
                const jsonMatch = content.match(/\[[\s\S]*?\]/);
                if (jsonMatch) {
                    parsedItems = JSON.parse(jsonMatch[0]);
                }
                
                if (!Array.isArray(parsedItems)) {
                    parsedItems = [];
                }
            } catch (e) {
                console.error('JSON解析错误:', e, '原始内容:', content);
                parsedItems = [];
            }

            // 确保每条记录都有完整字段
            const processedDrafts = parsedItems.map((item) => ({
                title: item.title || '',
                price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price)) || 0,
                description: item.description || '',
                keywords: item.keywords || [],
                trade_type: trade_type || 2,
                wechat_id: wechat_id || '',
                user_id: user_id
            }));

            return new Response(JSON.stringify({
                data: {
                    drafts: processedDrafts,
                    count: processedDrafts.length,
                    message: `成功解析${processedDrafts.length}条信息`
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Step 2: 批量发布草稿
        if (step === 'publish') {
            if (!drafts || !Array.isArray(drafts)) {
                throw new Error('草稿数据格式错误');
            }

            let successCount = 0;
            const errors: Array<{ title: string; error: string }> = [];

            for (const draft of drafts) {
                try {
                    const publishResponse = await fetch(
                        `${supabaseUrl}/rest/v1/posts`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=representation'
                            },
                            body: JSON.stringify({
                                user_id: draft.user_id || user_id,
                                title: draft.title,
                                price: parseFloat(String(draft.price)) || 0,
                                keywords: Array.isArray(draft.keywords) 
                                    ? draft.keywords.join(',') 
                                    : (typeof draft.keywords === 'string' ? draft.keywords : ''),
                                trade_type: draft.trade_type || trade_type || 2,
                                view_limit: 100,
                                view_count: 0,
                                status: 1,
                                expire_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3天后过期
                            })
                        }
                    );

                    if (publishResponse.ok) {
                        successCount++;
                    } else {
                        const errorText = await publishResponse.text();
                        console.error('发布失败:', errorText);
                        errors.push({
                            title: draft.title,
                            error: '发布失败'
                        });
                    }
                } catch (e) {
                    const errorMessage = e instanceof Error ? e.message : '未知错误';
                    errors.push({
                        title: draft.title,
                        error: errorMessage
                    });
                }
            }

            return new Response(JSON.stringify({
                data: {
                    success_count: successCount,
                    total_count: drafts.length,
                    errors: errors.length > 0 ? errors : null,
                    message: `成功发布${successCount}/${drafts.length}条信息`
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        throw new Error('无效的操作步骤，请指定step为parse或publish');

    } catch (error) {
        console.error('AI批量发布错误:', error);

        const errorMessage = error instanceof Error ? error.message : '未知错误';
        const errorResponse = {
            error: {
                code: 'AI_BATCH_PUBLISH_FAILED',
                message: errorMessage
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
