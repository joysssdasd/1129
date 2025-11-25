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
        const { user_id, text_input, trade_type, wechat_id, step } = await req.json();

        if (!user_id || !text_input) {
            throw new Error('缺少必填参数');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const deepseekApiKey = 'sk-4dac2f720dfc43a18dc3f46053a68f16';

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // Step 1: AI解析生成草稿
        if (step === 'parse') {
            const prompt = `你是一个专业的演唱会票务信息解析助手。请从以下文本中提取交易信息，每条信息生成一个JSON对象。

文本：
${text_input}

【重要】票档价格格式说明：
- "799-1100" 表示：799位置的票价格是1100元
- "1050-1199" 表示：1050位置的票价格是1199元
- "位置号-价格金额" 是固定格式，位置在前，价格在后
- 斜杠"/"分隔不同票档，如"799-1100/1050-1199"表示两个票档

解析要求：
1. 从标题中提取演出名称（如"上海梁静茹"）
2. 从票档信息中提取价格：
   - 选择第一个票档的价格作为主价格
   - 例如："799-1100/1050-1199" → 价格应该是1100（第一个票档的价格）
   - 例如："1199-1400/1400-1500" → 价格应该是1400（第一个票档的价格）
3. 在描述中记录：日期 + 位置信息
   - 例如："11.15号799位置"
   - 例如："11.16号1050位置"
4. 关键词：提取演出名称、城市、日期等关键信息
5. 交易类型：根据"特价录入/转让/出售"判断为2（卖出），"求购/收购"判断为1（买入）

示例1：
输入："上海梁静茹 特价录入 11.15/16 799-1100/1050-1199 1199-1400/1400-1500"
输出：
[
  {
    "title": "上海梁静茹",
    "price": 1100,
    "description": "11.15号799位置",
    "keywords": ["上海", "梁静茹", "演唱会", "11.15"],
    "trade_type": 2
  },
  {
    "title": "上海梁静茹",
    "price": 1199,
    "description": "11.15号1050位置",
    "keywords": ["上海", "梁静茹", "演唱会", "11.15"],
    "trade_type": 2
  },
  {
    "title": "上海梁静茹",
    "price": 1100,
    "description": "11.16号799位置",
    "keywords": ["上海", "梁静茹", "演唱会", "11.16"],
    "trade_type": 2
  },
  {
    "title": "上海梁静茹",
    "price": 1199,
    "description": "11.16号1050位置",
    "keywords": ["上海", "梁静茹", "演唱会", "11.16"],
    "trade_type": 2
  }
]

示例2：
输入："北京周杰伦 转让 12.1 588-800/688-900"
输出：
[
  {
    "title": "北京周杰伦",
    "price": 800,
    "description": "12.1号588位置",
    "keywords": ["北京", "周杰伦", "演唱会", "12.1"],
    "trade_type": 2
  },
  {
    "title": "北京周杰伦",
    "price": 900,
    "description": "12.1号688位置",
    "keywords": ["北京", "周杰伦", "演唱会", "12.1"],
    "trade_type": 2
  }
]

请严格按照以上格式解析，只返回JSON数组，不要其他文字：`;

            const aiResponse = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${deepseekApiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: '你是一个专业的交易信息解析助手，请严格按照要求输出JSON格式数据。' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3
                })
            });

            if (!aiResponse.ok) {
                throw new Error('AI解析失败');
            }

            const aiResult = await aiResponse.json();
            const content = aiResult.choices[0]?.message?.content || '[]';
            
            // 提取JSON数组
            let parsedItems = [];
            try {
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    parsedItems = JSON.parse(jsonMatch[0]);
                }
                // 验证解析结果
                if (!Array.isArray(parsedItems)) {
                    parsedItems = [];
                }
            } catch (e) {
                console.error('JSON解析错误:', e);
                parsedItems = [];
            }

            // 确保每条记录都有完整字段
            parsedItems = parsedItems.map((item: any) => ({
                title: item.title || '',
                price: item.price || 0,
                description: item.description || '',
                keywords: item.keywords || [],
                trade_type: trade_type || 2
            }));

            // 生成草稿
            const drafts = parsedItems.map((item: any) => ({
                ...item,
                trade_type: trade_type || 2,
                wechat_id: wechat_id || '',
                user_id: user_id
            }));

            return new Response(JSON.stringify({
                data: {
                    drafts,
                    count: drafts.length,
                    message: `成功解析${drafts.length}条信息`
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Step 2: 批量发布草稿
        if (step === 'publish') {
            const { drafts } = await req.json();
            
            if (!drafts || !Array.isArray(drafts)) {
                throw new Error('草稿数据格式错误');
            }

            let successCount = 0;
            const errors = [];

            for (const draft of drafts) {
                try {
                    // 调用发布接口
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
                                user_id: draft.user_id,
                                title: draft.title,
                                price: parseFloat(draft.price) || 0,
                                keywords: Array.isArray(draft.keywords) ? draft.keywords.join(',') : (typeof draft.keywords === 'string' ? draft.keywords : ''),
                                trade_type: draft.trade_type || 2,
                                view_limit: 100,
                                view_count: 0,
                                status: 1,
                                expire_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                            })
                        }
                    );

                    if (publishResponse.ok) {
                        successCount++;
                    } else {
                        errors.push({
                            title: draft.title,
                            error: '发布失败'
                        });
                    }
                } catch (e) {
                    errors.push({
                        title: draft.title,
                        error: e.message
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

        throw new Error('无效的操作步骤');

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
