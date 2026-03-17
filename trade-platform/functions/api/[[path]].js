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

const DEFAULT_GROWTH_SETTINGS = {
  registrationPoints: 500,
  dailyPostReward: 10,
  dailyPostRewardLimit: 5,
  dailyCheckinReward: 5,
  inviterRewardPoints: 10,
  inviteeRewardPoints: 30,
  registrationClaimWindowMs: 24 * 60 * 60 * 1000
}

const GROWTH_SETTING_FIELDS = [
  {
    key: 'registration_bonus_target_points',
    label: 'Registration target points',
    description: 'Target total points after a user finishes registration.',
    category: 'growth',
    min: 0,
    max: 5000,
    getValue: (settings) => settings.registrationPoints
  },
  {
    key: 'daily_post_reward_points',
    label: 'Daily post reward points',
    description: 'Points awarded for each rewarded post in a day.',
    category: 'growth',
    min: 0,
    max: 500,
    getValue: (settings) => settings.dailyPostReward
  },
  {
    key: 'daily_post_reward_limit',
    label: 'Daily rewarded post limit',
    description: 'How many posts can receive a reward each day.',
    category: 'growth',
    min: 0,
    max: 20,
    getValue: (settings) => settings.dailyPostRewardLimit
  },
  {
    key: 'daily_checkin_reward_points',
    label: 'Daily check-in reward points',
    description: 'Points awarded when a user checks in for the day.',
    category: 'growth',
    min: 0,
    max: 200,
    getValue: (settings) => settings.dailyCheckinReward
  }
]

const POINT_CHANGE_TYPES = {
  publishPost: 2,
  inviteReward: 4,
  dailyPostReward: 9,
  registrationTopUp: 10,
  dailyCheckIn: 11
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

const getShanghaiDateKey = (dateInput = new Date()) => {
  const source = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const timezoneOffsetMs = 8 * 60 * 60 * 1000
  const localTime = new Date(source.getTime() + timezoneOffsetMs)
  const year = localTime.getUTCFullYear()
  const month = String(localTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localTime.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const subtractShanghaiDays = (dateKey, days) => {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value))
  const utcTime = Date.UTC(year, month - 1, day) - days * 24 * 60 * 60 * 1000
  return getShanghaiDateKey(new Date(utcTime))
}

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.floor(parsed))
}

const buildGrowthSettings = (settingsMap = {}) => ({
  registrationPoints: toPositiveInteger(
    settingsMap.registration_bonus_target_points,
    DEFAULT_GROWTH_SETTINGS.registrationPoints
  ),
  dailyPostReward: toPositiveInteger(
    settingsMap.daily_post_reward_points,
    DEFAULT_GROWTH_SETTINGS.dailyPostReward
  ),
  dailyPostRewardLimit: toPositiveInteger(
    settingsMap.daily_post_reward_limit,
    DEFAULT_GROWTH_SETTINGS.dailyPostRewardLimit
  ),
  dailyCheckinReward: toPositiveInteger(
    settingsMap.daily_checkin_reward_points,
    DEFAULT_GROWTH_SETTINGS.dailyCheckinReward
  ),
  inviterRewardPoints: DEFAULT_GROWTH_SETTINGS.inviterRewardPoints,
  inviteeRewardPoints: DEFAULT_GROWTH_SETTINGS.inviteeRewardPoints,
  registrationClaimWindowMs: DEFAULT_GROWTH_SETTINGS.registrationClaimWindowMs
})

const maskPhone = (phone = '') => {
  if (typeof phone !== 'string' || phone.length < 7) return '鍖垮悕鐢ㄦ埛'
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

const computeCheckInStreak = (records = []) => {
  const uniqueDays = new Set(records.map((record) => getShanghaiDateKey(record.created_at)).filter(Boolean))
  if (uniqueDays.size === 0) return 0

  let cursor = getShanghaiDateKey(new Date())
  if (!uniqueDays.has(cursor)) {
    cursor = subtractShanghaiDays(cursor, 1)
  }

  let streak = 0
  while (uniqueDays.has(cursor)) {
    streak += 1
    cursor = subtractShanghaiDays(cursor, 1)
  }

  return streak
}

const upsertSystemSettings = async (config, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const upsertRes = await restRequest({
    config,
    resource: 'system_settings',
    query: 'on_conflict=key&select=id,key,value,category,created_at,updated_at',
    method: 'POST',
    body: rows,
    useServiceRole: true,
    extraHeaders: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    }
  })

  if (!upsertRes.ok) {
    throw new Error(upsertRes.text || 'Failed to upsert system settings')
  }

  return Array.isArray(upsertRes.data) ? upsertRes.data : []
}

const loadSystemSettingsMap = async (config, keys, options = {}) => {
  const { ensureDefaults = false } = options

  const query =
    keys && keys.length
      ? `key=in.(${keys.map((key) => `"${key}"`).join(',')})&select=id,key,value,category,created_at,updated_at`
      : 'select=id,key,value,category,created_at,updated_at'

  const settingsRes = await restRequest({
    config,
    resource: 'system_settings',
    query,
    useServiceRole: true
  })

  if (!settingsRes.ok) {
    throw new Error(settingsRes.text || 'Failed to load system settings')
  }

  let rows = Array.isArray(settingsRes.data) ? settingsRes.data : []

  if (ensureDefaults && keys?.length) {
    const existingKeys = new Set(rows.map((row) => row.key))
    const missingRows = GROWTH_SETTING_FIELDS.filter((field) => keys.includes(field.key) && !existingKeys.has(field.key)).map(
      (field) => ({
        key: field.key,
        value: String(field.getValue(DEFAULT_GROWTH_SETTINGS)),
        category: field.category,
        updated_at: new Date().toISOString()
      })
    )

    if (missingRows.length) {
      const insertedRows = await upsertSystemSettings(config, missingRows)
      rows = [...rows, ...insertedRows]
    }
  }

  return rows.reduce((accumulator, row) => {
    if (row?.key) {
      accumulator[row.key] = row.value
    }
    return accumulator
  }, {})
}

const loadGrowthSettings = async (config, options = {}) => {
  if (!config.serviceRoleKey) {
    return buildGrowthSettings({})
  }

  const settingsMap = await loadSystemSettingsMap(
    config,
    GROWTH_SETTING_FIELDS.map((field) => field.key),
    options
  )

  return buildGrowthSettings(settingsMap)
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

const verifyAdminRequest = async ({ config, request }) => {
  const adminUserId = request.headers.get('x-admin-user-id') || ''
  if (!UUID_RE.test(adminUserId)) {
    return {
      ok: false,
      response: json({ success: false, error: { code: 'INVALID_ADMIN_ID', message: 'Invalid admin user id.' } }, 401)
    }
  }

  const isAdmin = await verifyAdminUser({ config, adminUserId })
  if (!isAdmin) {
    return {
      ok: false,
      response: json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can manage this resource.' } }, 403)
    }
  }

  return { ok: true, adminUserId }
}

const serializeAdminGrowthSettings = (growthSettings) =>
  GROWTH_SETTING_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    description: field.description,
    value: field.getValue(growthSettings),
    min: field.min,
    max: field.max
  }))

const handleAdminGrowthSettingsGet = async ({ request, config }) => {
  const missingServiceRoleResponse = requireServiceRole(config)
  if (missingServiceRoleResponse) return missingServiceRoleResponse

  try {
    const adminCheck = await verifyAdminRequest({ config, request })
    if (!adminCheck.ok) return adminCheck.response

    const growthSettings = await loadGrowthSettings(config, { ensureDefaults: true })
    return json({
      success: true,
      data: {
        settings: serializeAdminGrowthSettings(growthSettings)
      }
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'ADMIN_GROWTH_SETTINGS_ERROR',
          message: error?.message || 'Failed to load growth settings.'
        }
      },
      500
    )
  }
}

const handleAdminGrowthSettingUpdate = async ({ request, config, settingKey }) => {
  const missingServiceRoleResponse = requireServiceRole(config)
  if (missingServiceRoleResponse) return missingServiceRoleResponse

  const field = GROWTH_SETTING_FIELDS.find((item) => item.key === settingKey)
  if (!field) {
    return json({ success: false, error: { code: 'SETTING_NOT_FOUND', message: 'Unsupported growth setting.' } }, 404)
  }

  try {
    const adminCheck = await verifyAdminRequest({ config, request })
    if (!adminCheck.ok) return adminCheck.response

    const payload = await readJsonBody(request)
    const rawValue = payload?.value
    const nextValue = toPositiveInteger(rawValue, NaN)
    if (!Number.isFinite(nextValue)) {
      return json({ success: false, error: { code: 'INVALID_VALUE', message: 'Setting value must be a number.' } }, 400)
    }

    if (nextValue < field.min || nextValue > field.max) {
      return json(
        {
          success: false,
          error: {
            code: 'SETTING_OUT_OF_RANGE',
            message: `Setting value must be between ${field.min} and ${field.max}.`
          }
        },
        400
      )
    }

    await upsertSystemSettings(config, [
      {
        key: field.key,
        value: String(nextValue),
        category: field.category,
        updated_at: new Date().toISOString()
      }
    ])

    const growthSettings = await loadGrowthSettings(config, { ensureDefaults: true })
    return json({
      success: true,
      data: {
        setting: serializeAdminGrowthSettings(growthSettings).find((item) => item.key === field.key)
      }
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'ADMIN_GROWTH_SETTING_UPDATE_ERROR',
          message: error?.message || 'Failed to update growth setting.'
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
    const growthSettings = await loadGrowthSettings(config, { ensureDefaults: true })
    const user = await loadUserForReward(config, userId)
    if (!user) {
      return json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } }, 404)
    }

    const createdAtMs = new Date(user.created_at).getTime()
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > growthSettings.registrationClaimWindowMs) {
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
          targetPoints: growthSettings.registrationPoints,
          alreadyApplied: true
        }
      })
    }

    const pointsAdded = Math.max(0, growthSettings.registrationPoints - Number(user.points || 0))
    if (pointsAdded === 0) {
      return json({
        success: true,
        data: {
          user,
          pointsAdded: 0,
          targetPoints: growthSettings.registrationPoints,
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
        description: `注册送积分补齐至${growthSettings.registrationPoints}`,
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
        targetPoints: growthSettings.registrationPoints
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

const buildGrowthTasks = ({ growthSettings, checkedInToday, rewardedCount, successfulInvites }) => [
  {
    key: 'daily_checkin',
    title: '每日签到',
    description: '每天来站里打卡，维持活跃度',
    rewardPoints: growthSettings.dailyCheckinReward,
    completed: checkedInToday,
    progress: checkedInToday ? 1 : 0,
    target: 1,
    actionLabel: checkedInToday ? '已完成' : '去签到'
  },
  {
    key: 'daily_publish',
    title: '每日发帖任务',
    description: '当天前几条发帖可拿额外积分奖励',
    rewardPoints: growthSettings.dailyPostReward,
    completed: rewardedCount >= growthSettings.dailyPostRewardLimit,
    progress: rewardedCount,
    target: growthSettings.dailyPostRewardLimit,
    actionLabel: rewardedCount >= growthSettings.dailyPostRewardLimit ? '已完成' : '去发帖'
  },
  {
    key: 'invite_reward',
    title: '邀请好友首发',
    description: '邀请好友注册并完成首发，双方都有奖励',
    rewardPoints: growthSettings.inviterRewardPoints,
    completed: successfulInvites > 0,
    progress: successfulInvites,
    target: 1,
    actionLabel: successfulInvites > 0 ? '继续邀请' : '去邀请'
  }
]

const loadGrowthDashboardData = async ({ config, userId, origin }) => {
  const growthSettings = await loadGrowthSettings(config, { ensureDefaults: true })
  const user = await loadUserForReward(config, userId)

  if (!user) {
    throw new Error('User not found.')
  }

  const todayRange = getShanghaiDayRange(new Date())
  const [checkInTodayRes, checkInHistoryRes, dailyRewardRes, todayPostsRes, inviteRes, invitePointRes, rewardFeedRes] = await Promise.all([
    restRequest({
      config,
      resource: 'point_transactions',
      query:
        `user_id=eq.${encodeURIComponent(userId)}` +
        `&change_type=eq.${POINT_CHANGE_TYPES.dailyCheckIn}` +
        `&created_at=gte.${encodeURIComponent(todayRange.start)}` +
        `&created_at=lt.${encodeURIComponent(todayRange.end)}` +
        '&select=id,created_at,change_amount&order=created_at.desc&limit=1',
      useServiceRole: true
    }),
    restRequest({
      config,
      resource: 'point_transactions',
      query:
        `user_id=eq.${encodeURIComponent(userId)}` +
        `&change_type=eq.${POINT_CHANGE_TYPES.dailyCheckIn}` +
        '&select=id,created_at&order=created_at.desc&limit=30',
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
        '&select=id,created_at&order=created_at.desc&limit=20',
      useServiceRole: true
    }),
    restRequest({
      config,
      resource: 'posts',
      query:
        `user_id=eq.${encodeURIComponent(userId)}` +
        `&created_at=gte.${encodeURIComponent(todayRange.start)}` +
        `&created_at=lt.${encodeURIComponent(todayRange.end)}` +
        '&select=id,title,created_at&order=created_at.desc&limit=20',
      useServiceRole: true
    }),
    restRequest({
      config,
      resource: 'invitations',
      query: `inviter_code=eq.${encodeURIComponent(user.invite_code || '')}&select=id,has_posted,reward_sent,created_at,completed_at&order=created_at.desc&limit=100`,
      useServiceRole: true
    }),
    restRequest({
      config,
      resource: 'point_transactions',
      query:
        `user_id=eq.${encodeURIComponent(userId)}` +
        `&change_type=eq.${POINT_CHANGE_TYPES.inviteReward}` +
        '&select=id,change_amount&limit=200',
      useServiceRole: true
    }),
    restRequest({
      config,
      resource: 'point_transactions',
      query:
        `user_id=eq.${encodeURIComponent(userId)}` +
        `&change_type=in.(${POINT_CHANGE_TYPES.dailyCheckIn},${POINT_CHANGE_TYPES.dailyPostReward},${POINT_CHANGE_TYPES.registrationTopUp},${POINT_CHANGE_TYPES.inviteReward})` +
        '&select=id,change_type,change_amount,description,created_at&order=created_at.desc&limit=8',
      useServiceRole: true
    })
  ])

  const checkInToday = Array.isArray(checkInTodayRes.data) ? checkInTodayRes.data[0] : null
  const checkInHistory = Array.isArray(checkInHistoryRes.data) ? checkInHistoryRes.data : []
  const dailyRewards = Array.isArray(dailyRewardRes.data) ? dailyRewardRes.data : []
  const todayPosts = Array.isArray(todayPostsRes.data) ? todayPostsRes.data : []
  const invitations = Array.isArray(inviteRes.data) ? inviteRes.data : []
  const invitePoints = Array.isArray(invitePointRes.data) ? invitePointRes.data : []
  const rewardFeed = Array.isArray(rewardFeedRes.data) ? rewardFeedRes.data : []

  const successfulInvites = invitations.filter((invite) => invite.reward_sent).length
  const pendingInvites = Math.max(0, invitations.length - successfulInvites)
  const checkedInToday = Boolean(checkInToday)
  const rewardedCount = dailyRewards.length
  const streakDays = computeCheckInStreak(checkInHistory)
  const invitationLink = `${origin}/register?ref=${user.invite_code || ''}`

  return {
    user: {
      id: user.id,
      points: Number(user.points || 0),
      total_posts: Number(user.total_posts || 0),
      invite_code: user.invite_code || ''
    },
    settings: growthSettings,
    checkIn: {
      checkedInToday,
      rewardPoints: growthSettings.dailyCheckinReward,
      streakDays,
      checkedInAt: checkInToday?.created_at || null
    },
    dailyPublish: {
      publishedTodayCount: todayPosts.length,
      rewardedCount,
      rewardLimit: growthSettings.dailyPostRewardLimit,
      rewardPoints: growthSettings.dailyPostReward,
      remainingRewardSlots: Math.max(0, growthSettings.dailyPostRewardLimit - rewardedCount)
    },
    invitation: {
      inviteCode: user.invite_code || '',
      invitationLink,
      totalInvites: Number(user.total_invites || invitations.length || 0),
      successfulInvites,
      pendingInvites,
      totalPointsEarned: invitePoints.reduce((sum, item) => sum + Number(item.change_amount || 0), 0),
      inviterRewardPoints: growthSettings.inviterRewardPoints,
      inviteeRewardPoints: growthSettings.inviteeRewardPoints
    },
    tasks: buildGrowthTasks({
      growthSettings,
      checkedInToday,
      rewardedCount,
      successfulInvites
    }),
    recentRewards: rewardFeed.map((item) => ({
      id: item.id,
      changeType: Number(item.change_type || 0),
      changeAmount: Number(item.change_amount || 0),
      description: item.description || '',
      createdAt: item.created_at
    }))
  }
}

const handleGrowthConfig = async ({ config }) => {
  try {
    const growthSettings = await loadGrowthSettings(config, { ensureDefaults: true })
    return json({
      success: true,
      data: {
        settings: growthSettings
      }
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'GROWTH_CONFIG_ERROR',
          message: error?.message || 'Failed to load growth settings.'
        }
      },
      500
    )
  }
}

const handleGrowthDashboard = async ({ request, config }) => {
  const requestUrl = new URL(request.url)
  const userId = requestUrl.searchParams.get('userId') || ''

  if (!UUID_RE.test(userId)) {
    return json({ success: false, error: { code: 'INVALID_USER_ID', message: 'Invalid user id.' } }, 400)
  }

  try {
    const dashboard = await loadGrowthDashboardData({
      config,
      userId,
      origin: requestUrl.origin
    })
    return json({ success: true, data: dashboard })
  } catch (error) {
    const status = /User not found/i.test(error?.message || '') ? 404 : 500
    return json(
      {
        success: false,
        error: {
          code: 'GROWTH_DASHBOARD_ERROR',
          message: error?.message || 'Failed to load growth dashboard.'
        }
      },
      status
    )
  }
}

const handleDailyCheckIn = async ({ request, config }) => {
  const missingServiceRoleResponse = requireServiceRole(config)
  if (missingServiceRoleResponse) return missingServiceRoleResponse

  const payload = await readJsonBody(request)
  const userId = payload?.userId
  if (!UUID_RE.test(userId || '')) {
    return json({ success: false, error: { code: 'INVALID_USER_ID', message: 'Invalid user id.' } }, 400)
  }

  try {
    const growthSettings = await loadGrowthSettings(config, { ensureDefaults: true })
    const user = await loadUserForReward(config, userId)
    if (!user) {
      return json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } }, 404)
    }

    const todayRange = getShanghaiDayRange(new Date())
    const todayCheckInRes = await restRequest({
      config,
      resource: 'point_transactions',
      query:
        `user_id=eq.${encodeURIComponent(userId)}` +
        `&change_type=eq.${POINT_CHANGE_TYPES.dailyCheckIn}` +
        `&created_at=gte.${encodeURIComponent(todayRange.start)}` +
        `&created_at=lt.${encodeURIComponent(todayRange.end)}` +
        '&select=id,created_at&order=created_at.desc&limit=1',
      useServiceRole: true
    })

    if (!todayCheckInRes.ok) {
      throw new Error(todayCheckInRes.text || 'Failed to verify check-in state')
    }

    if (todayCheckInRes.data?.length) {
      const historyRes = await restRequest({
        config,
        resource: 'point_transactions',
        query:
          `user_id=eq.${encodeURIComponent(userId)}` +
          `&change_type=eq.${POINT_CHANGE_TYPES.dailyCheckIn}` +
          '&select=id,created_at&order=created_at.desc&limit=30',
        useServiceRole: true
      })
      const streakDays = computeCheckInStreak(Array.isArray(historyRes.data) ? historyRes.data : [])

      return json({
        success: true,
        data: {
          awarded: false,
          alreadyCheckedIn: true,
          rewardPoints: 0,
          streakDays,
          checkedInAt: todayCheckInRes.data[0].created_at,
          user: {
            id: user.id,
            points: Number(user.points || 0),
            total_posts: Number(user.total_posts || 0)
          }
        }
      })
    }

    const updatedUser = await updateUserPoints(config, userId, Number(user.points || 0) + growthSettings.dailyCheckinReward)
    const checkedInAt = new Date().toISOString()

    await insertPointTransaction(config, {
      user_id: userId,
      change_type: POINT_CHANGE_TYPES.dailyCheckIn,
      change_amount: growthSettings.dailyCheckinReward,
      balance_after: updatedUser?.points ?? Number(user.points || 0) + growthSettings.dailyCheckinReward,
      description: '每日签到奖励',
      created_at: checkedInAt
    })

    const historyRes = await restRequest({
      config,
      resource: 'point_transactions',
      query:
        `user_id=eq.${encodeURIComponent(userId)}` +
        `&change_type=eq.${POINT_CHANGE_TYPES.dailyCheckIn}` +
        '&select=id,created_at&order=created_at.desc&limit=30',
      useServiceRole: true
    })

    return json({
      success: true,
      data: {
        awarded: true,
        rewardPoints: growthSettings.dailyCheckinReward,
        streakDays: computeCheckInStreak(Array.isArray(historyRes.data) ? historyRes.data : []),
        checkedInAt,
        user: {
          id: updatedUser?.id || user.id,
          points: Number(updatedUser?.points ?? Number(user.points || 0) + growthSettings.dailyCheckinReward),
          total_posts: Number(updatedUser?.total_posts ?? (user.total_posts || 0))
        }
      }
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'DAILY_CHECKIN_ERROR',
          message: error?.message || 'Failed to claim daily check-in reward.'
        }
      },
      500
    )
  }
}

const handlePublishLeaderboard = async ({ request, config }) => {
  try {
    const requestUrl = new URL(request.url)
    const window = requestUrl.searchParams.get('window') === 'all' ? 'all' : '7d'
    const currentUserId = requestUrl.searchParams.get('userId') || ''

    let entries = []
    if (window === '7d') {
      const rangeStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const postsRes = await restRequest({
        config,
        resource: 'posts',
        query: `created_at=gte.${encodeURIComponent(rangeStart)}&select=id,user_id,created_at&limit=1000`,
        useServiceRole: true
      })

      if (!postsRes.ok) {
        throw new Error(postsRes.text || 'Failed to load leaderboard posts')
      }

      const posts = Array.isArray(postsRes.data) ? postsRes.data : []
      const countMap = posts.reduce((accumulator, post) => {
        const key = post.user_id
        if (!key) return accumulator
        accumulator[key] = (accumulator[key] || 0) + 1
        return accumulator
      }, {})

      const userIds = Object.keys(countMap)
      if (userIds.length) {
        const usersRes = await restRequest({
          config,
          resource: 'users',
          query:
            `id=in.(${userIds.map((id) => `"${id}"`).join(',')})` +
            '&select=id,phone,wechat_id,total_posts,points',
          useServiceRole: true
        })

        if (!usersRes.ok) {
          throw new Error(usersRes.text || 'Failed to load leaderboard users')
        }

        const users = Array.isArray(usersRes.data) ? usersRes.data : []
        entries = users
          .map((item) => ({
            userId: item.id,
            displayName: item.wechat_id || maskPhone(item.phone),
            weeklyPosts: countMap[item.id] || 0,
            totalPosts: Number(item.total_posts || 0),
            points: Number(item.points || 0)
          }))
          .sort((left, right) => {
            if (right.weeklyPosts !== left.weeklyPosts) return right.weeklyPosts - left.weeklyPosts
            if (right.totalPosts !== left.totalPosts) return right.totalPosts - left.totalPosts
            return right.points - left.points
          })
          .slice(0, 10)
      }
    }

    if (!entries.length) {
      const usersRes = await restRequest({
        config,
        resource: 'users',
        query: 'select=id,phone,wechat_id,total_posts,points&limit=50',
        useServiceRole: true
      })

      if (!usersRes.ok) {
        throw new Error(usersRes.text || 'Failed to load all-time leaderboard users')
      }

      entries = (Array.isArray(usersRes.data) ? usersRes.data : [])
        .map((item) => ({
          userId: item.id,
          displayName: item.wechat_id || maskPhone(item.phone),
          weeklyPosts: 0,
          totalPosts: Number(item.total_posts || 0),
          points: Number(item.points || 0)
        }))
        .sort((left, right) => {
          if (right.totalPosts !== left.totalPosts) return right.totalPosts - left.totalPosts
          return right.points - left.points
        })
        .slice(0, 10)
    }

    const rankedEntries = entries.map((item, index) => ({
      rank: index + 1,
      ...item,
      isCurrentUser: UUID_RE.test(currentUserId) ? item.userId === currentUserId : false
    }))

    const currentUserRank = UUID_RE.test(currentUserId)
      ? rankedEntries.find((item) => item.userId === currentUserId)?.rank || null
      : null

    return json({
      success: true,
      data: {
        window,
        windowLabel: window === '7d' ? '近7天发帖榜' : '总发帖榜',
        entries: rankedEntries,
        currentUserRank
      }
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'PUBLISH_LEADERBOARD_ERROR',
          message: error?.message || 'Failed to load publish leaderboard.'
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
    const growthSettings = await loadGrowthSettings(config, { ensureDefaults: true })
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
          remainingDailyRewardSlots: Math.max(0, growthSettings.dailyPostRewardLimit - existingCount),
          user: {
            id: user.id,
            points: Number(user.points || 0),
            total_posts: Number(user.total_posts || 0)
          }
        }
      })
    }

    const rewardedToday = Array.isArray(dailyRewardCountRes.data) ? dailyRewardCountRes.data.length : 0
    if (rewardedToday >= growthSettings.dailyPostRewardLimit) {
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

    const updatedUser = await updateUserPoints(config, userId, Number(user.points || 0) + growthSettings.dailyPostReward)

    try {
      await insertPointTransaction(config, {
        user_id: userId,
        change_type: POINT_CHANGE_TYPES.dailyPostReward,
        change_amount: growthSettings.dailyPostReward,
        balance_after: updatedUser?.points ?? Number(user.points || 0) + growthSettings.dailyPostReward,
        related_id: postId,
        description: `每日前${growthSettings.dailyPostRewardLimit}条发帖奖励`,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to record daily publish reward transaction:', error)
    }

    return json({
      success: true,
      data: {
        awarded: true,
        rewardPoints: growthSettings.dailyPostReward,
        dailyRewardCount: rewardedToday + 1,
        remainingDailyRewardSlots: Math.max(0, growthSettings.dailyPostRewardLimit - rewardedToday - 1),
        user: {
          id: updatedUser?.id || user.id,
          points: Number(updatedUser?.points ?? Number(user.points || 0) + growthSettings.dailyPostReward),
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

  if (request.method === 'GET' && pathSegments[0] === 'admin' && pathSegments[1] === 'growth-settings') {
    return handleAdminGrowthSettingsGet({ request, config })
  }

  if (
    request.method === 'PATCH' &&
    pathSegments[0] === 'admin' &&
    pathSegments[1] === 'growth-settings' &&
    pathSegments[2]
  ) {
    return handleAdminGrowthSettingUpdate({
      request,
      config,
      settingKey: decodeURIComponent(pathSegments[2])
    })
  }

  if (request.method === 'POST' && pathSegments[0] === 'auth' && pathSegments[1] === 'registration-bonus') {
    return handleRegistrationBonus({ request, config })
  }

  if (request.method === 'POST' && pathSegments[0] === 'posts' && pathSegments[1] === 'daily-publish-reward') {
    return handleDailyPostReward({ request, config })
  }

  if (request.method === 'GET' && pathSegments[0] === 'growth' && pathSegments[1] === 'config') {
    return handleGrowthConfig({ config })
  }

  if (request.method === 'GET' && pathSegments[0] === 'growth' && pathSegments[1] === 'dashboard') {
    return handleGrowthDashboard({ request, config })
  }

  if (request.method === 'POST' && pathSegments[0] === 'growth' && pathSegments[1] === 'check-in') {
    return handleDailyCheckIn({ request, config })
  }

  if (request.method === 'GET' && pathSegments[0] === 'growth' && pathSegments[1] === 'leaderboard') {
    return handlePublishLeaderboard({ request, config })
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
