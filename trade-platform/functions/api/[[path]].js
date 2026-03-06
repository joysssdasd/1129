// EdgeOne Pages Function: proxy Supabase requests and handle privileged admin category update.

const DEFAULT_SUPABASE_URL = 'https://hntiihuxqlklpiyqmlob.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudGlpaHV4cWxrbHBpeXFtbG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTE1ODksImV4cCI6MjA3OTU2NzU4OX0.yh4FiKZPUPR-G1LormpZuKGZIaF7eSRkDbZslvBJzhc'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-user-id',
  'Access-Control-Max-Age': '86400'
}

const UUID_RE = /^[0-9a-fA-F-]{36}$/

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  })

const getPathSegments = (params) => {
  if (Array.isArray(params?.path)) {
    return params.path.filter(Boolean)
  }
  if (typeof params?.path === 'string') {
    return params.path.split('/').filter(Boolean)
  }
  return []
}

const getSupabaseConfig = (context) => {
  const env = context?.env || {}
  return {
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || ''
  }
}

const getResponseText = async (res) => {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

const verifyAdminUser = async ({ supabaseUrl, serviceRoleKey, adminUserId }) => {
  const verifyUrl = `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(adminUserId)}&select=id,is_admin&limit=1`
  const verifyRes = await fetch(verifyUrl, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  })

  if (!verifyRes.ok) {
    const body = await getResponseText(verifyRes)
    throw new Error(body || 'Failed to verify admin user')
  }

  const users = await verifyRes.json()
  return Boolean(users?.[0]?.is_admin)
}

const handleAdminCategoryUpdate = async ({ request, categoryId, config }) => {
  if (!config.serviceRoleKey) {
    return json(
      {
        success: false,
        error: {
          code: 'MISSING_SERVICE_ROLE_KEY',
          message: 'SUPABASE_SERVICE_ROLE_KEY is not configured in EdgeOne environment.'
        }
      },
      500
    )
  }

  if (!UUID_RE.test(categoryId)) {
    return json({ success: false, error: { code: 'INVALID_CATEGORY_ID', message: 'Invalid category id.' } }, 400)
  }

  const adminUserId = request.headers.get('x-admin-user-id') || ''
  if (!UUID_RE.test(adminUserId)) {
    return json({ success: false, error: { code: 'INVALID_ADMIN_ID', message: 'Invalid admin user id.' } }, 401)
  }

  try {
    const isAdmin = await verifyAdminUser({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.serviceRoleKey,
      adminUserId
    })

    if (!isAdmin) {
      return json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can update categories.' } }, 403)
    }

    const payload = await request.json().catch(() => null)
    if (!payload || typeof payload !== 'object') {
      return json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid request payload.' } }, 400)
    }

    const allowed = ['name', 'icon', 'description', 'sort_order', 'is_active']
    const updates = {}
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        updates[key] = payload[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ success: false, error: { code: 'EMPTY_UPDATES', message: 'No editable fields provided.' } }, 400)
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) {
        return json({ success: false, error: { code: 'INVALID_NAME', message: 'Category name is required.' } }, 400)
      }
      updates.name = updates.name.trim()
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
      if (updates.description !== null && typeof updates.description !== 'string') {
        return json({ success: false, error: { code: 'INVALID_DESCRIPTION', message: 'Description must be a string.' } }, 400)
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'sort_order')) {
      if (typeof updates.sort_order !== 'number' || !Number.isFinite(updates.sort_order)) {
        return json({ success: false, error: { code: 'INVALID_SORT_ORDER', message: 'sort_order must be a number.' } }, 400)
      }
    }

    updates.updated_at = new Date().toISOString()

    const updateUrl = `${config.supabaseUrl}/rest/v1/categories?id=eq.${encodeURIComponent(categoryId)}&select=id,name,icon,description,sort_order,is_active,updated_at`
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(updates)
    })

    const result = await updateRes.json().catch(() => null)
    if (!updateRes.ok) {
      const message = result?.message || result?.error || 'Failed to update category'
      return json({ success: false, error: { code: 'UPDATE_FAILED', message } }, updateRes.status)
    }

    if (!Array.isArray(result) || result.length === 0) {
      return json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found.' } }, 404)
    }

    return json({ success: true, data: result[0] })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'ADMIN_CATEGORY_UPDATE_ERROR',
          message: error?.message || 'Unexpected error while updating category.'
        }
      },
      500
    )
  }
}

export async function onRequest(context) {
  const { request, params } = context
  const pathSegments = getPathSegments(params)
  const path = pathSegments.join('/')
  const config = getSupabaseConfig(context)

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS
    })
  }

  if (
    request.method === 'PATCH' &&
    pathSegments[0] === 'admin' &&
    pathSegments[1] === 'categories' &&
    pathSegments[2]
  ) {
    return handleAdminCategoryUpdate({
      request,
      categoryId: pathSegments[2],
      config
    })
  }

  try {
    const reqUrl = new URL(request.url)
    const targetUrl = `${config.supabaseUrl}/${path}${reqUrl.search}`
    const headers = new Headers(request.headers)

    if (!headers.has('apikey')) {
      headers.set('apikey', config.anonKey)
    }
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${config.anonKey}`)
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined
    })

    const responseHeaders = new Headers(response.headers)
    responseHeaders.set('Access-Control-Allow-Origin', '*')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    })
  } catch (error) {
    return json({
      error: {
        code: 'PROXY_ERROR',
        message: error?.message || 'Failed to proxy request'
      }
    }, 500)
  }
}