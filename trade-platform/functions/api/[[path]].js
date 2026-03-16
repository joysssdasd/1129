// EdgeOne Pages Function: proxy Supabase requests and handle privileged app mutations.

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

const GROWTH_RULES = {
  registrationPoints: 500,
  dailyPostReward: 10,
  dailyPostRewardLimit: 5,
  registrationClaimWindowMs: 24 * 60 * 60 * 1000
}

const POINT_CHANGE_TYPES = {
  publishPost: 2,
  dailyPostReward: 9,
  registrationTopUp: 10
}

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

const parseJson = (text) => {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const readJsonBody = async (request) => request.json().catch(() => null)

const buildRestUrl = (config, resource, query = '') =>
  `${config.supabaseUrl}/rest/v1/${resource}${query ? (query.startsWith('?') ? query : `?${query}`) : ''}`

const createAuthHeaders = (token, extraHeaders = {}) => ({
  apikey: token,
  Authorization: `Bearer ${token}`,
  ...extraHeaders
})

const restRequest = async ({
  config,
  resource,
  query = '',
  method = 'GET',
  body,
  useServiceRole = false,
  extraHeaders = {}
}) => {
  const token = useServiceRole ? config.serviceRoleKey : config.anonKey

  if (!token) {
    throw new Error('Missing Supabase credentials for requested operation.')
  }

  const response = await fetch(buildRestUrl(config, resource, query), {
    method,
    headers: createAuthHeaders(token, extraHeaders),
    body: body === undefined ? undefined : JSON.stringify(body)
  })

  const text = await getResponseText(response)

  return {
    ok: response.ok,
    status: response.status,
    data: parseJson(text),
    text
  }
}

const requireServiceRole = (config) => {
  if (config.serviceRoleKey) return null

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

const getShanghaiDayRange = (dateInput = new Date()) => {
  const source = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const timezoneOffsetMs = 8 * 60 * 60 * 1000
  const localTime = new Date(source.getTime() + timezoneOffsetMs)
  const localMidnightUtcMs =
    Date.UTC(localTime.getUTCFullYear(), localTime.getUTCMonth(), localTime.getUTCDate()) - timezoneOffsetMs

  return {
    start: new Date(localMidnightUtcMs).toISOString(),
    end: new Date(localMidnightUtcMs + 24 * 60 * 60 * 1000).toISOString()
  }
}

const verifyAdminUser = async ({ config, adminUserId }) => {
  const verifyRes = await restRequest({
    config,
    resource: 'users',
    query: `id=eq.${encodeURIComponent(adminUserId)}&select=id,is_admin&limit=1`,
    useServiceRole: true
  })

  if (!verifyRes.ok) {
    throw new Error(verifyRes.text || 'Failed to verify admin user')
  }

  return Boolean(verifyRes.data?.[0]?.is_admin)
}

const handleAdminCategoryUpdate = async ({ request, categoryId, config }) => {
  const missingServiceRoleResponse = requireServiceRole(config)
  if (missingServiceRoleResponse) return missingServiceRoleResponse

  if (!UUID_RE.test(categoryId)) {
    return json({ success: false, error: { code: 'INVALID_CATEGORY_ID', message: 'Invalid category id.' } }, 400)
  }

  const adminUserId = request.headers.get('x-admin-user-id') || ''
  if (!UUID_RE.test(adminUserId)) {
    return json({ success: false, error: { code: 'INVALID_ADMIN_ID', message: 'Invalid admin user id.' } }, 401)
  }

  try {
    const isAdmin = await verifyAdminUser({ config, adminUserId })

    if (!isAdmin) {
      return json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can update categories.' } }, 403)
    }

    const payload = await readJsonBody(request)
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

    const updateRes = await restRequest({
      config,
      resource: 'categories',
      query: `id=eq.${encodeURIComponent(categoryId)}&select=id,name,icon,description,sort_order,is_active,updated_at`,
      method: 'PATCH',
      body: updates,
      useServiceRole: true,
      extraHeaders: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }
    })

    if (!updateRes.ok) {
      const message = updateRes.data?.message || updateRes.data?.error || 'Failed to update category'
      return json({ success: false, error: { code: 'UPDATE_FAILED', message } }, updateRes.status)
    }

    if (!Array.isArray(updateRes.data) || updateRes.data.length === 0) {
      return json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found.' } }, 404)
    }

    return json({ success: true, data: updateRes.data[0] })
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

const loadUserForReward = async (config, userId) => {
  const userRes = await restRequest({
    config,
    resource: 'users',
    query:
      `id=eq.${encodeURIComponent(userId)}` +
      '&select=id,phone,wechat_id,invite_code,invited_by,points,deal_rate,total_posts,total_deals,total_invites,is_admin,status,created_at,updated_at' +
      '&limit=1',
    useServiceRole: true
  })

  if (!userRes.ok) {
    throw new Error(userRes.text || 'Failed to load user')
  }

  return userRes.data?.[0] || null
}

const updateUserPoints = async (config, userId, nextPoints) => {
  const updateRes = await restRequest({
    config,
    resource: 'users',
    query:
      `id=eq.${encodeURIComponent(userId)}` +
      '&select=id,phone,wechat_id,invite_code,invited_by,points,deal_rate,total_posts,total_deals,total_invites,is_admin,status,created_at,updated_at',
    method: 'PATCH',
    body: {
      points: nextPoints,
      updated_at: new Date().toISOString()
    },
    useServiceRole: true,
    extraHeaders: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  })

  if (!updateRes.ok) {
    throw new Error(updateRes.text || 'Failed to update user points')
  }

  return updateRes.data?.[0] || null
}

const insertPointTransaction = async (config, payload) => {
  const insertRes = await restRequest({
    config,
    resource: 'point_transactions',
    method: 'POST',
    body: payload,
    useServiceRole: true,
    extraHeaders: {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    }
  })

  if (!insertRes.ok) {
    throw new Error(insertRes.text || 'Failed to insert point transaction')
  }
}

const handleRegistrationBonus = async ({ request, config }) => {
  const missingServiceRoleResponse = requireServiceRole(config)
  if (missingServiceRoleResponse) return missingServiceRoleResponse

  const payload = await readJsonBody(request)
  const userId = payload?.userId

  if (!UUID_RE.test(userId || '')) {
    return json({ success: false, error: { code: 'INVALID_USER_ID', message: 'Invalid user id.' } }, 400)
  }

  try {
    const user = await loadUserForReward(config, userId)
    if (!user) {
      return json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } }, 404)
    }

    const createdAtMs = new Date(user.created_at).getTime()
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > GROWTH_RULES.registrationClaimWindowMs) {
      return json(
        {
          success: false,
          error: {
            code: 'REGISTRATION_BONUS_WINDOW_EXPIRED',
            message: 'Registration bonus top-up can only be claimed shortly after registration.'
          }
        },
        403
      )
    }

    const existingTopUpRes = await restRequest({
      config,
      resource: 'point_transactions',
      query:
        `user_id=eq.${encodeURIComponent(userId)}` +
        `&change_type=eq.${POINT_CHANGE_TYPES.registrationTopUp}` +
        `&related_id=eq.${encodeURIComponent(userId)}` +
        '&select=id&limit=1',
      useServiceRole: true
    })

    if (!existingTopUpRes.ok) {
      throw new Error(existingTopUpRes.text || 'Failed to verify registration bonus state')
    }

    if (existingTopUpRes.data?.length) {
      return json({
        success: true,
        data: {
          user,
          pointsAdded: 0,
          targetPoints: GROWTH_RULES.registrationPoints,
          alreadyApplied: true
        }
      })
    }

    const pointsAdded = Math.max(0, GROWTH_RULES.registrationPoints - Number(user.points || 0))
    if (pointsAdded === 0) {
      return json({
        success: true,
        data: {
          user,
          pointsAdded: 0,
          targetPoints: GROWTH_RULES.registrationPoints,
          alreadyApplied: true
        }
      })
    }

    const updatedUser = await updateUserPoints(config, userId, Number(user.points || 0) + pointsAdded)

    try {
      await insertPointTransaction(config, {
        user_id: userId,
        change_type: POINT_CHANGE_TYPES.registrationTopUp,
        change_amount: pointsAdded,
        balance_after: updatedUser?.points ?? Number(user.points || 0) + pointsAdded,
        related_id: userId,
        description: `注册送积分补齐至${GROWTH_RULES.registrationPoints}`,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to record registration bonus top-up transaction:', error)
    }

    return json({
      success: true,
      data: {
        user: updatedUser || { ...user, points: Number(user.points || 0) + pointsAdded },
        pointsAdded,
        targetPoints: GROWTH_RULES.registrationPoints
      }
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'REGISTRATION_BONUS_ERROR',
          message: error?.message || 'Failed to apply registration bonus top-up.'
        }
      },
      500
    )
  }
}

const handleDailyPostReward = async ({ request, config }) => {
  const missingServiceRoleResponse = requireServiceRole(config)
  if (missingServiceRoleResponse) return missingServiceRoleResponse

  const payload = await readJsonBody(request)
  const userId = payload?.userId
  const postId = payload?.postId

  if (!UUID_RE.test(userId || '')) {
    return json({ success: false, error: { code: 'INVALID_USER_ID', message: 'Invalid user id.' } }, 400)
  }

  if (!UUID_RE.test(postId || '')) {
    return json({ success: false, error: { code: 'INVALID_POST_ID', message: 'Invalid post id.' } }, 400)
  }

  try {
    const postRes = await restRequest({
      config,
      resource: 'posts',
      query:
        `id=eq.${encodeURIComponent(postId)}` +
        `&user_id=eq.${encodeURIComponent(userId)}` +
        '&select=id,user_id,title,created_at&limit=1',
      useServiceRole: true
    })

    if (!postRes.ok) {
      throw new Error(postRes.text || 'Failed to load post')
    }

    const post = postRes.data?.[0]
    if (!post) {
      return json({ success: false, error: { code: 'POST_NOT_FOUND', message: 'Post not found.' } }, 404)
    }

    const todayRange = getShanghaiDayRange(new Date())
    if (post.created_at < todayRange.start || post.created_at >= todayRange.end) {
      const user = await loadUserForReward(config, userId)
      return json({
        success: true,
        data: {
          awarded: false,
          rewardPoints: 0,
          dailyRewardCount: 0,
          remainingDailyRewardSlots: 0,
          user: {
            id: user?.id || userId,
            points: Number(user?.points || 0),
            total_posts: Number(user?.total_posts || 0)
          }
        }
      })
    }

    const [user, publishTransactionRes, existingRewardRes, dailyRewardCountRes] = await Promise.all([
      loadUserForReward(config, userId),
      restRequest({
        config,
        resource: 'point_transactions',
        query:
          `user_id=eq.${encodeURIComponent(userId)}` +
          `&change_type=eq.${POINT_CHANGE_TYPES.publishPost}` +
          `&related_id=eq.${encodeURIComponent(postId)}` +
          '&select=id&limit=1',
        useServiceRole: true
      }),
      restRequest({
        config,
        resource: 'point_transactions',
        query:
          `user_id=eq.${encodeURIComponent(userId)}` +
          `&change_type=eq.${POINT_CHANGE_TYPES.dailyPostReward}` +
          `&related_id=eq.${encodeURIComponent(postId)}` +
          '&select=id&limit=1',
        useServiceRole: true
      }),
      restRequest({
        config,
        resource: 'point_transactions',
        query:
          `user_id=eq.${encodeURIComponent(userId)}` +
          `&change_type=eq.${POINT_CHANGE_TYPES.dailyPostReward}` +
          `&created_at=gte.${encodeURIComponent(todayRange.start)}` +
          `&created_at=lt.${encodeURIComponent(todayRange.end)}` +
          '&select=id',
        useServiceRole: true
      })
    ])

    if (!user) {
      return json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } }, 404)
    }

    if (!publishTransactionRes.ok) {
      throw new Error(publishTransactionRes.text || 'Failed to verify publish transaction')
    }

    if (!existingRewardRes.ok) {
      throw new Error(existingRewardRes.text || 'Failed to verify reward transaction state')
    }

    if (!dailyRewardCountRes.ok) {
      throw new Error(dailyRewardCountRes.text || 'Failed to count daily publish rewards')
    }

    if (!publishTransactionRes.data?.length) {
      return json(
        {
          success: false,
          error: {
            code: 'PUBLISH_TRANSACTION_NOT_FOUND',
            message: 'The post publish transaction could not be verified.'
          }
        },
        409
      )
    }

    if (existingRewardRes.data?.length) {
      const existingCount = Array.isArray(dailyRewardCountRes.data) ? dailyRewardCountRes.data.length : 0
      return json({
        success: true,
        data: {
          awarded: false,
          alreadyRewarded: true,
          rewardPoints: 0,
          dailyRewardCount: existingCount,
          remainingDailyRewardSlots: Math.max(0, GROWTH_RULES.dailyPostRewardLimit - existingCount),
          user: {
            id: user.id,
            points: Number(user.points || 0),
            total_posts: Number(user.total_posts || 0)
          }
        }
      })
    }

    const rewardedToday = Array.isArray(dailyRewardCountRes.data) ? dailyRewardCountRes.data.length : 0
    if (rewardedToday >= GROWTH_RULES.dailyPostRewardLimit) {
      return json({
        success: true,
        data: {
          awarded: false,
          rewardPoints: 0,
          dailyRewardCount: rewardedToday,
          remainingDailyRewardSlots: 0,
          user: {
            id: user.id,
            points: Number(user.points || 0),
            total_posts: Number(user.total_posts || 0)
          }
        }
      })
    }

    const updatedUser = await updateUserPoints(config, userId, Number(user.points || 0) + GROWTH_RULES.dailyPostReward)

    try {
      await insertPointTransaction(config, {
        user_id: userId,
        change_type: POINT_CHANGE_TYPES.dailyPostReward,
        change_amount: GROWTH_RULES.dailyPostReward,
        balance_after: updatedUser?.points ?? Number(user.points || 0) + GROWTH_RULES.dailyPostReward,
        related_id: postId,
        description: `每日前${GROWTH_RULES.dailyPostRewardLimit}条发帖奖励`,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to record daily publish reward transaction:', error)
    }

    return json({
      success: true,
      data: {
        awarded: true,
        rewardPoints: GROWTH_RULES.dailyPostReward,
        dailyRewardCount: rewardedToday + 1,
        remainingDailyRewardSlots: Math.max(0, GROWTH_RULES.dailyPostRewardLimit - rewardedToday - 1),
        user: {
          id: updatedUser?.id || user.id,
          points: Number(updatedUser?.points ?? Number(user.points || 0) + GROWTH_RULES.dailyPostReward),
          total_posts: Number(updatedUser?.total_posts ?? (user.total_posts || 0))
        }
      }
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'DAILY_POST_REWARD_ERROR',
          message: error?.message || 'Failed to apply daily post reward.'
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

  if (request.method === 'POST' && pathSegments[0] === 'auth' && pathSegments[1] === 'registration-bonus') {
    return handleRegistrationBonus({ request, config })
  }

  if (request.method === 'POST' && pathSegments[0] === 'posts' && pathSegments[1] === 'daily-publish-reward') {
    return handleDailyPostReward({ request, config })
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
    return json(
      {
        error: {
          code: 'PROXY_ERROR',
          message: error?.message || 'Failed to proxy request'
        }
      },
      500
    )
  }
}
