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
        const { user_id, file_data, file_name, bucket } = await req.json();
        
        console.log('上传文件请求:', { user_id, file_name, bucket });

        if (!user_id || !file_data || !bucket) {
            throw new Error('缺少必要参数');
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('系统配置错误');
        }

        // 解析 base64 数据
        let base64Data = file_data;
        let contentType = 'image/jpeg';
        
        if (file_data.startsWith('data:')) {
            const matches = file_data.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                contentType = matches[1];
                base64Data = matches[2];
            }
        }

        // 转换 base64 为二进制
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // 生成文件名
        const timestamp = Date.now();
        const ext = contentType.split('/')[1] || 'jpg';
        const fileName = file_name || `${user_id}_${timestamp}.${ext}`;

        // 上传到 Storage
        const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;
        
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': contentType,
                'x-upsert': 'true'
            },
            body: bytes
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('上传失败:', errorText);
            throw new Error(`上传失败: ${uploadResponse.status}`);
        }

        // 获取公开 URL
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`;

        console.log('上传成功:', publicUrl);

        return new Response(JSON.stringify({
            data: {
                url: publicUrl,
                file_name: fileName,
                bucket: bucket
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('上传文件错误:', error);

        return new Response(JSON.stringify({
            error: {
                code: 'UPLOAD_FAILED',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
