// Get keyword price analytics data for K-line charts
Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const keyword = url.searchParams.get('keyword');
        const tradeType = url.searchParams.get('trade_type');
        const days = parseInt(url.searchParams.get('days') || '30');
        const mode = url.searchParams.get('mode') || 'realtime'; // 'realtime' or 'snapshot'

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase configuration missing');
        }

        let chartData;

        if (mode === 'snapshot' && keyword) {
            // Get historical snapshot data
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            let query = `${supabaseUrl}/rest/v1/keyword_price_snapshots?keyword=eq.${encodeURIComponent(keyword)}&snapshot_date=gte.${startDate.toISOString().split('T')[0]}&order=snapshot_date.asc`;
            
            if (tradeType) {
                query += `&trade_type=eq.${tradeType}`;
            }

            const snapshotResponse = await fetch(query, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            });

            const snapshots = await snapshotResponse.json();

            chartData = snapshots.map(s => ({
                date: s.snapshot_date,
                open: parseFloat(s.open_price),
                close: parseFloat(s.close_price),
                high: parseFloat(s.high_price),
                low: parseFloat(s.low_price),
                volume: s.post_count,
                avg: parseFloat(s.avg_price)
            }));

        } else {
            // Real-time aggregation from posts table
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            let query = `${supabaseUrl}/rest/v1/posts?created_at=gte.${startDate.toISOString()}&status=eq.1&order=created_at.asc`;
            
            if (keyword) {
                query += `&keywords=eq.${encodeURIComponent(keyword)}`;
            }
            if (tradeType) {
                query += `&trade_type=eq.${tradeType}`;
            }

            const postsResponse = await fetch(query, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            });

            const posts = await postsResponse.json();

            // Group by date and calculate OHLC
            const groupedByDate = {};
            
            posts.forEach(post => {
                const date = post.created_at.split('T')[0];
                if (!groupedByDate[date]) {
                    groupedByDate[date] = [];
                }
                groupedByDate[date].push(parseFloat(post.price));
            });

            chartData = Object.keys(groupedByDate).sort().map(date => {
                const prices = groupedByDate[date].sort((a, b) => a - b);
                return {
                    date,
                    open: prices[0],
                    close: prices[prices.length - 1],
                    high: Math.max(...prices),
                    low: Math.min(...prices),
                    volume: prices.length,
                    avg: prices.reduce((a, b) => a + b, 0) / prices.length
                };
            });
        }

        // Get all unique keywords for dropdown
        const keywordsResponse = await fetch(
            `${supabaseUrl}/rest/v1/posts?select=keywords&status=eq.1`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            }
        );

        const allPosts = await keywordsResponse.json();
        const uniqueKeywords = [...new Set(allPosts.map(p => p.keywords))].filter(k => k);

        return new Response(JSON.stringify({
            data: {
                chartData,
                availableKeywords: uniqueKeywords,
                metadata: {
                    keyword: keyword || 'All',
                    tradeType: tradeType || 'All',
                    days,
                    mode,
                    dataPoints: chartData.length
                }
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({
            error: {
                code: 'ANALYTICS_ERROR',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
