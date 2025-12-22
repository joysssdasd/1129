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
        const body = await req.json().catch(() => ({}));
        const { trade_type, keyword, page = 0, page_size = 20 } = body;
        
        console.log('获取帖子列表参数:', body);

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 构建查询URL
        let url = `${supabaseUrl}/rest/v1/posts?status=eq.1&order=created_at.desc&limit=${page_size}&offset=${page * page_size}`;
        
        // 类型筛选
        if (trade_type && trade_type > 0) {
            url += `&trade_type=eq.${trade_type}`;
        }
        
        // 关键词搜索
        if (keyword) {
            url += `&or=(title.ilike.*${keyword}*,keywords.ilike.*${keyword}*)`;
        }

        console.log('查询URL:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('查询失败:', errorText);
            throw new Error('查询失败');
        }

        const posts = await response.json();
        console.log('查询结果数量:', posts.length);

        return new Response(JSON.stringify({
            data: {
                posts,
                page,
                page_size,
                has_more: posts.length === page_size
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('获取帖子列表错误:', error);

        return new Response(JSON.stringify({
            error: {
                code: 'GET_POSTS_FAILED',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
