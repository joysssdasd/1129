// EdgeOne Pages 边缘函数 - 代理 Supabase 请求
// 这个函数会将 /api/* 的请求转发到 Supabase

export async function onRequest(context) {
  const { request, params } = context;
  
  // 获取请求路径
  const path = params.path ? params.path.join('/') : '';
  
  // Supabase 配置
  const SUPABASE_URL = 'https://hntiihuxqlklpiyqmlob.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudGlpaHV4cWxrbHBpeXFtbG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTE1ODksImV4cCI6MjA3OTU2NzU4OX0.yh4FiKZPUPR-G1LormpZuKGZIaF7eSRkDbZslvBJzhc';
  
  // 构建目标 URL
  const targetUrl = `${SUPABASE_URL}/${path}`;
  
  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  try {
    // 复制原始请求的 headers
    const headers = new Headers(request.headers);
    
    // 确保有 apikey
    if (!headers.has('apikey')) {
      headers.set('apikey', SUPABASE_ANON_KEY);
    }
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    }
    
    // 转发请求
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined
    });
    
    // 复制响应
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: {
        code: 'PROXY_ERROR',
        message: error.message || 'Failed to proxy request'
      }
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
