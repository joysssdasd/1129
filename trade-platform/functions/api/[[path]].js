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
const PHONE_RE = /^1[3-9]\d{9}$/
const INVITE_CODE_RE = /^[A-Z0-9]{6,10}$/
const INITIAL_REGISTRATION_POINTS = 30

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
  registration: 1,
  publishPost: 2,
  inviteReward: 4,
  dailyPostReward: 9,
  registrationTopUp: 10,
  dailyCheckIn: 11
}

const AUTO_MARKET_INFO_PREFIX = '__managed_market__'
const LEGACY_AUTO_MARKET_INFO_PREFIX = '自动整理自微信群行情'
const MANAGED_SYNC_KIND = 'niuniubase.managed-market-sync'
const MANAGED_SYNC_PROTOCOL_VERSION = 1
const AUTO_MARKET_SETTING_CATEGORIES = {
  state: 'wechat_market_state',
  history: 'wechat_market_history',
  runs: 'wechat_market_runs'
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

  const normalizedRows = rows.reduce((accumulator, row) => {
    if (!row?.key) return accumulator
    const existingIndex = accumulator.findIndex((item) => item.key === row.key)
    if (existingIndex >= 0) {
      accumulator[existingIndex] = row
    } else {
      accumulator.push(row)
    }
    return accumulator
  }, [])

  const existingRes = await restRequest({
    config,
    resource: 'system_settings',
    query:
      `key=in.(${normalizedRows.map((row) => `"${row.key}"`).join(',')})` +
      '&select=id,key,value,category,created_at,updated_at',
    useServiceRole: true
  })

  if (!existingRes.ok) {
    throw new Error(existingRes.text || 'Failed to load existing system settings')
  }

  const existingRows = Array.isArray(existingRes.data) ? existingRes.data : []
  const existingKeySet = new Set(existingRows.map((row) => row?.key).filter(Boolean))
  const updatedRows = []
  const rowsToInsert = []

  for (const row of normalizedRows) {
    const payload = {
      value: row.value,
      category: row.category,
      updated_at: row.updated_at || new Date().toISOString()
    }

    if (existingKeySet.has(row.key)) {
      const updateRes = await restRequest({
        config,
        resource: 'system_settings',
        query: `key=eq.${encodeURIComponent(row.key)}&select=id,key,value,category,created_at,updated_at`,
        method: 'PATCH',
        body: payload,
        useServiceRole: true,
        extraHeaders: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        }
      })

      if (!updateRes.ok) {
        throw new Error(updateRes.text || `Failed to update system setting: ${row.key}`)
      }

      updatedRows.push(...(Array.isArray(updateRes.data) ? updateRes.data : []))
      continue
    }

    rowsToInsert.push({
      key: row.key,
      ...payload
    })
  }

  if (rowsToInsert.length) {
    const insertRes = await restRequest({
      config,
      resource: 'system_settings',
      query: 'select=id,key,value,category,created_at,updated_at',
      method: 'POST',
      body: rowsToInsert,
      useServiceRole: true,
      extraHeaders: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }
    })

    if (!insertRes.ok) {
      throw new Error(insertRes.text || 'Failed to insert system settings')
    }

    updatedRows.push(...(Array.isArray(insertRes.data) ? insertRes.data : []))
  }

  return updatedRows
}

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

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

const resolveWechatAutoOperator = async ({ config, requestedUserId = '' }) => {
  if (UUID_RE.test(requestedUserId)) {
    const operatorRes = await restRequest({
      config,
      resource: 'users',
      query: `id=eq.${encodeURIComponent(requestedUserId)}&select=id,wechat_id,is_admin&limit=1`,
      useServiceRole: true
    })

    if (!operatorRes.ok) {
      throw new Error(operatorRes.text || 'Failed to load requested operator user')
    }

    const operator = operatorRes.data?.[0]
    if (!operator?.is_admin) {
      throw new Error('Requested operator user must be an admin account')
    }

    return operator
  }

  const settingsMap = await loadSystemSettingsMap(config, ['customer_wechat'])
  const customerWechat = settingsMap.customer_wechat || 'niuniubase'
  const operatorRes = await restRequest({
    config,
    resource: 'users',
    query:
      `wechat_id=eq.${encodeURIComponent(customerWechat)}` +
      '&is_admin=eq.true' +
      '&select=id,wechat_id,is_admin&limit=1',
    useServiceRole: true
  })

  if (!operatorRes.ok) {
    throw new Error(operatorRes.text || 'Failed to resolve WeChat auto publish operator')
  }

  const operator = operatorRes.data?.[0]
  if (!operator?.id) {
    throw new Error('No admin operator user matches customer_wechat')
  }

  return operator
}

const normalizeWechatAutoPost = (rawPost) => {
  if (!rawPost || typeof rawPost !== 'object') {
    return { ok: false, message: 'Invalid post payload.' }
  }

  const title = String(rawPost.title || '').trim()
  const keywords = String(rawPost.keywords || '').trim()
  const extraInfo = rawPost.extraInfo == null ? null : String(rawPost.extraInfo).trim()
  const categoryId = String(rawPost.categoryId || '').trim()
  const categoryName = String(rawPost.categoryName || '').trim()
  const tradeType = Number(rawPost.tradeType)
  const price = Number(rawPost.price)
  const expireHours = Math.max(1, Math.min(24 * 30, Number(rawPost.expireHours || 24 * 7)))
  const viewLimit = Math.max(1, Math.min(1000, Number(rawPost.viewLimit || 100)))
  const itemName = String(rawPost.itemName || '').trim()
  const city = String(rawPost.city || '').trim() || '全国'
  const eventDate = String(rawPost.eventDate || '').trim()
  const specOrTier = String(rawPost.specOrTier || '').trim()
  const quantity = String(rawPost.quantity || '').trim()
  const sourceRef = String(rawPost.sourceRef || '').trim()
  const marketKey = String(rawPost.marketKey || '').trim()
  const signalCount = Math.max(0, Number(rawPost.signalCount || 0))
  const groupCount = Math.max(0, Number(rawPost.groupCount || 0))

  if (!title) {
    return { ok: false, message: 'Post title is required.' }
  }

  if (!keywords) {
    return { ok: false, message: 'Post keywords are required.' }
  }

  if (!UUID_RE.test(categoryId)) {
    return { ok: false, message: 'A valid categoryId is required.' }
  }

  if (![1, 2].includes(tradeType)) {
    return { ok: false, message: 'tradeType must be 1 or 2.' }
  }

  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, message: 'price must be a positive number.' }
  }

  return {
    ok: true,
    value: {
      title: title.slice(0, 100),
      keywords: keywords.slice(0, 200),
      extraInfo: extraInfo ? extraInfo.slice(0, 100) : null,
      categoryId,
      categoryName,
      tradeType,
      price,
      expireHours,
      viewLimit,
      itemName: itemName.slice(0, 100),
      city: city.slice(0, 32),
      eventDate: eventDate.slice(0, 32),
      specOrTier: specOrTier.slice(0, 64),
      quantity: quantity.slice(0, 32),
      sourceRef: sourceRef.slice(0, 200),
      marketKey: marketKey.slice(0, 200),
      signalCount,
      groupCount
    }
  }
}

const normalizeManagedMarketKeyPart = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[【】\[\]()（）{}<>《》:：,，。；;'"`|\\/]/gu, '')
    .trim()

const hashText = (input = '') => {
  let h1 = 0x811c9dc5
  let h2 = 5381
  for (const char of String(input)) {
    const code = char.codePointAt(0) || 0
    h1 ^= code
    h1 = Math.imul(h1, 16777619) >>> 0
    h2 = Math.imul(h2, 33) ^ code
    h2 >>>= 0
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}

const parseJsonValue = (value, fallback = null) => {
  if (value == null || value === '') return fallback

  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return fallback
  }
}

const buildManagedMarketKey = (post) => {
  if (post.marketKey) {
    return post.marketKey
  }

  const specKey = post.categoryName === '演唱会' ? post.specOrTier : ''

  return [
    post.categoryId,
    post.tradeType,
    post.itemName || post.title,
    post.city || '全国',
    post.eventDate || '',
    specKey || ''
  ]
    .map((value) => normalizeManagedMarketKeyPart(value))
    .filter(Boolean)
    .join('|')
}

const buildManagedStateSettingKey = (marketKey) => `${AUTO_MARKET_SETTING_CATEGORIES.state}:${hashText(marketKey)}`

const buildManagedHistorySettingKey = (marketKey, action) =>
  `${AUTO_MARKET_SETTING_CATEGORIES.history}:${getShanghaiDateKey(new Date())}:${hashText(marketKey)}:${action}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const loadSystemSettingRowsByKeys = async (config, keys) => {
  if (!Array.isArray(keys) || keys.length === 0) return {}

  const uniqueKeys = [...new Set(keys.filter(Boolean))]
  const settingsRes = await restRequest({
    config,
    resource: 'system_settings',
    query:
      `key=in.(${uniqueKeys.map((key) => `"${key}"`).join(',')})` +
      '&select=id,key,value,category,created_at,updated_at',
    useServiceRole: true
  })

  if (!settingsRes.ok) {
    throw new Error(settingsRes.text || 'Failed to load managed market settings')
  }

  return (Array.isArray(settingsRes.data) ? settingsRes.data : []).reduce((accumulator, row) => {
    if (row?.key) {
      accumulator[row.key] = row
    }
    return accumulator
  }, {})
}

const loadPostById = async (config, postId) => {
  if (!UUID_RE.test(postId)) return null

  const postRes = await restRequest({
    config,
    resource: 'posts',
    query:
      `id=eq.${encodeURIComponent(postId)}` +
      '&select=id,user_id,title,keywords,price,trade_type,category_id,extra_info,view_limit,status,expire_at,created_at,updated_at' +
      '&limit=1',
    useServiceRole: true
  })

  if (!postRes.ok) {
    throw new Error(postRes.text || 'Failed to load managed market post')
  }

  return Array.isArray(postRes.data) ? postRes.data[0] || null : null
}

const loadPostsByIds = async (config, postIds) => {
  const uniqueIds = [...new Set((Array.isArray(postIds) ? postIds : []).filter((id) => UUID_RE.test(id)))]
  if (!uniqueIds.length) return {}

  const postsRes = await restRequest({
    config,
    resource: 'posts',
    query:
      `id=in.(${uniqueIds.map((id) => `"${id}"`).join(',')})` +
      '&select=id,user_id,title,keywords,price,trade_type,category_id,extra_info,view_limit,status,expire_at,created_at,updated_at',
    useServiceRole: true
  })

  if (!postsRes.ok) {
    throw new Error(postsRes.text || 'Failed to load managed market posts by ids')
  }

  return (Array.isArray(postsRes.data) ? postsRes.data : []).reduce((accumulator, row) => {
    if (row?.id) {
      accumulator[row.id] = row
    }
    return accumulator
  }, {})
}

const findRecentAutoPublishedPost = async ({ config, operatorId, post }) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const existingRes = await restRequest({
    config,
    resource: 'posts',
    query:
      `user_id=eq.${encodeURIComponent(operatorId)}` +
      `&category_id=eq.${encodeURIComponent(post.categoryId)}` +
      `&trade_type=eq.${post.tradeType}` +
      `&price=eq.${post.price}` +
      `&title=eq.${encodeURIComponent(post.title)}` +
      `&created_at=gte.${encodeURIComponent(since)}` +
      '&select=id,title,price,trade_type,category_id,expire_at,created_at' +
      '&order=created_at.desc' +
      '&limit=1',
    useServiceRole: true
  })

  if (!existingRes.ok) {
    throw new Error(existingRes.text || 'Failed to check existing auto-published posts')
  }

  return Array.isArray(existingRes.data) ? existingRes.data[0] || null : null
}

const findExistingAutoMarketPost = async ({ config, operatorId, post }) => {
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
  const existingRes = await restRequest({
    config,
    resource: 'posts',
    query:
      `user_id=eq.${encodeURIComponent(operatorId)}` +
      `&category_id=eq.${encodeURIComponent(post.categoryId)}` +
      `&trade_type=eq.${post.tradeType}` +
      `&title=eq.${encodeURIComponent(post.title)}` +
      `&created_at=gte.${encodeURIComponent(since)}` +
      '&select=id,user_id,title,keywords,price,trade_type,category_id,extra_info,view_limit,status,expire_at,created_at,updated_at' +
      '&order=created_at.desc' +
      '&limit=5',
    useServiceRole: true
  })

  if (!existingRes.ok) {
    throw new Error(existingRes.text || 'Failed to locate existing auto market post')
  }

  return Array.isArray(existingRes.data) ? existingRes.data.find((row) => isManagedAutoMarketPost(row)) || null : null
}

const insertManagedMarketPost = async ({ config, operatorId, post, expireAt }) => {
  const insertRes = await restRequest({
    config,
    resource: 'posts',
    query:
      'select=id,user_id,title,keywords,price,trade_type,category_id,extra_info,view_limit,status,expire_at,created_at,updated_at',
    method: 'POST',
    body: [
      {
        user_id: operatorId,
        title: post.title,
        keywords: post.keywords,
        price: post.price,
        trade_type: post.tradeType,
        delivery_date: null,
        extra_info: post.extraInfo,
        view_limit: post.viewLimit,
        view_count: 0,
        deal_count: 0,
        status: 1,
        expire_at: expireAt,
        category_id: post.categoryId
      }
    ],
    useServiceRole: true,
    extraHeaders: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  })

  if (!insertRes.ok || !Array.isArray(insertRes.data) || !insertRes.data[0]) {
    throw new Error(insertRes.text || 'Failed to create managed market post')
  }

  return insertRes.data[0]
}

const updateManagedMarketPost = async ({ config, postId, payload }) => {
  const updateRes = await restRequest({
    config,
    resource: 'posts',
    query:
      `id=eq.${encodeURIComponent(postId)}` +
      '&select=id,user_id,title,keywords,price,trade_type,category_id,extra_info,view_limit,status,expire_at,created_at,updated_at',
    method: 'PATCH',
    body: payload,
    useServiceRole: true,
    extraHeaders: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  })

  if (!updateRes.ok || !Array.isArray(updateRes.data) || !updateRes.data[0]) {
    throw new Error(updateRes.text || 'Failed to update managed market post')
  }

  return updateRes.data[0]
}

const shouldRefreshManagedExpireAt = (currentExpireAt, nextExpireAt) => {
  if (!currentExpireAt) return true

  const currentMs = Date.parse(currentExpireAt)
  const nextMs = Date.parse(nextExpireAt)
  if (!Number.isFinite(currentMs) || !Number.isFinite(nextMs)) return true

  const refreshThresholdMs = 48 * 60 * 60 * 1000
  return currentMs <= Date.now() + refreshThresholdMs || currentMs > nextMs
}

const buildManagedPostUpdatePayload = ({ currentPost, post, expireAt }) => {
  const payload = {}
  const changedFields = []

  if (currentPost.title !== post.title) {
    payload.title = post.title
    changedFields.push('title')
  }

  if ((currentPost.keywords || '') !== post.keywords) {
    payload.keywords = post.keywords
    changedFields.push('keywords')
  }

  if (Number(currentPost.price || 0) !== post.price) {
    payload.price = post.price
    changedFields.push('price')
  }

  if (Number(currentPost.trade_type || 0) !== post.tradeType) {
    payload.trade_type = post.tradeType
    changedFields.push('tradeType')
  }

  if (String(currentPost.category_id || '') !== post.categoryId) {
    payload.category_id = post.categoryId
    changedFields.push('categoryId')
  }

  if ((currentPost.extra_info || null) !== (post.extraInfo || null)) {
    payload.extra_info = post.extraInfo
    changedFields.push('extraInfo')
  }

  if (Number(currentPost.view_limit || 0) !== post.viewLimit) {
    payload.view_limit = post.viewLimit
    changedFields.push('viewLimit')
  }

  if (Number(currentPost.status || 0) !== 1) {
    payload.status = 1
    changedFields.push('status')
  }

  if (shouldRefreshManagedExpireAt(currentPost.expire_at, expireAt)) {
    payload.expire_at = expireAt
  }

  if (Object.keys(payload).length > 0) {
    payload.updated_at = new Date().toISOString()
  }

  return {
    payload,
    changedFields,
    shouldUpdate: Object.keys(payload).length > 0
  }
}

const buildManagedMarketStateRow = ({ marketKey, stateKey, post, postRow, runDate, syncMeta }) => ({
  key: stateKey,
  category: AUTO_MARKET_SETTING_CATEGORIES.state,
  value: JSON.stringify({
    marketKey,
    postId: postRow.id,
    categoryId: post.categoryId,
    categoryName: post.categoryName || '',
    tradeType: post.tradeType,
    title: post.title,
    itemName: post.itemName || '',
    city: post.city || '全国',
    eventDate: post.eventDate || '',
    specOrTier: post.specOrTier || '',
    quantity: post.quantity || '',
    price: post.price,
    sourceRef: post.sourceRef || '',
    signalCount: Number(post.signalCount || 0),
    groupCount: Number(post.groupCount || 0),
    lastSeenAt: new Date().toISOString(),
    lastRunDate: runDate,
    lastRunId: syncMeta?.runId || '',
    lastPlanId: syncMeta?.planId || '',
    lastPlanHash: syncMeta?.planHash || '',
    lastPayloadHash: syncMeta?.payloadHash || '',
    lastPhase: syncMeta?.phase || ''
  })
})

const buildManagedHistoryRow = ({ marketKey, action, payload }) => ({
  key: buildManagedHistorySettingKey(marketKey, action),
  category: AUTO_MARKET_SETTING_CATEGORIES.history,
  value: JSON.stringify({
    action,
    marketKey,
    at: new Date().toISOString(),
    ...payload
  })
})

const buildManagedRunSettingKey = ({ runId, phase, payloadHash }) =>
  `${AUTO_MARKET_SETTING_CATEGORIES.runs}:${hashText(`${runId}|${phase}|${payloadHash || 'no-payload'}`)}`

const buildManagedRunHistoryRow = ({ syncMeta, counts, failures }) => ({
  key: buildManagedRunSettingKey(syncMeta),
  category: AUTO_MARKET_SETTING_CATEGORIES.runs,
  value: JSON.stringify({
    kind: syncMeta.kind || 'legacy_posts_payload',
    protocolVersion: syncMeta.protocolVersion || 0,
    runId: syncMeta.runId || '',
    runDate: syncMeta.runDate || getShanghaiDateKey(new Date()),
    dryRun: syncMeta.dryRun === true,
    phase: syncMeta.phase || 'sync',
    batchIndex: Number.isFinite(syncMeta.batchIndex) ? syncMeta.batchIndex : null,
    batchCount: Number.isFinite(syncMeta.batchCount) ? syncMeta.batchCount : null,
    planId: syncMeta.planId || '',
    planHash: syncMeta.planHash || '',
    payloadHash: syncMeta.payloadHash || '',
    actionCounts: counts,
    failureCount: Array.isArray(failures) ? failures.length : 0,
    failures: Array.isArray(failures) ? failures.slice(0, 10) : [],
    at: new Date().toISOString()
  })
})

const buildManagedSyncAction = ({
  action,
  marketKey,
  requestedPost,
  currentPost,
  nextPost,
  changedFields = [],
  reason = '',
  dryRun = false,
  status = ''
}) => ({
  action,
  status: status || (dryRun ? 'planned' : 'applied'),
  marketKey,
  postId: nextPost?.id || currentPost?.id || null,
  title: requestedPost?.title || nextPost?.title || currentPost?.title || '',
  previousTitle: currentPost?.title || null,
  nextTitle: requestedPost?.title || nextPost?.title || null,
  previousPrice: currentPost ? Number(currentPost.price || 0) : null,
  nextPrice:
    requestedPost && Number.isFinite(Number(requestedPost.price))
      ? Number(requestedPost.price)
      : nextPost
        ? Number(nextPost.price || 0)
        : null,
  tradeType:
    requestedPost && Number.isFinite(Number(requestedPost.tradeType))
      ? Number(requestedPost.tradeType)
      : Number(nextPost?.trade_type || currentPost?.trade_type || 0),
  categoryId: requestedPost?.categoryId || nextPost?.category_id || currentPost?.category_id || null,
  changedFields,
  dryRun,
  reason
})

const normalizeManagedSyncRequest = (payload) => {
  const manifest = isPlainObject(payload?.manifest) ? payload.manifest : null

  if (!manifest) {
    const runDate = /^\d{4}-\d{2}-\d{2}$/.test(String(payload?.runDate || ''))
      ? String(payload.runDate)
      : getShanghaiDateKey(new Date())

    return {
      ok: true,
      kind: 'legacy_posts_payload',
      protocolVersion: 0,
      requestedUserId: payload?.operatorUserId,
      posts: Array.isArray(payload?.posts) ? payload.posts : [],
      syncMode: payload?.syncMode === 'managed_market',
      deactivateMissing: payload?.syncMode === 'managed_market' && payload?.deactivateMissing !== false,
      activeMarketKeys: [...new Set((Array.isArray(payload?.activeMarketKeys) ? payload.activeMarketKeys : []).map((value) => String(value || '').trim()).filter(Boolean))],
      runDate,
      runId: `legacy-${runDate}-${Date.now().toString(36)}`,
      dryRun: payload?.dryRun === true,
      planId: '',
      planHash: '',
      payloadHash: '',
      phase: payload?.dryRun === true ? 'preview' : 'sync',
      batchIndex: null,
      batchCount: null
    }
  }

  if (manifest.kind !== MANAGED_SYNC_KIND) {
    return { ok: false, message: 'Unsupported managed sync manifest kind.' }
  }

  if (Number(manifest.protocolVersion || 0) !== MANAGED_SYNC_PROTOCOL_VERSION) {
    return { ok: false, message: 'Unsupported managed sync manifest version.' }
  }

  const plan = isPlainObject(manifest.plan) ? manifest.plan : {}
  const run = isPlainObject(manifest.run) ? manifest.run : {}
  const execution = isPlainObject(manifest.execution) ? manifest.execution : {}
  const runDate = /^\d{4}-\d{2}-\d{2}$/.test(String(run.runDate || ''))
    ? String(run.runDate)
    : getShanghaiDateKey(new Date())

  return {
    ok: true,
    kind: manifest.kind,
    protocolVersion: Number(manifest.protocolVersion || 0),
    requestedUserId: payload?.operatorUserId || manifest?.operator?.userId || '',
    posts: Array.isArray(plan.posts) ? plan.posts : [],
    syncMode: plan.syncMode === 'managed_market' || payload?.syncMode === 'managed_market',
    deactivateMissing: plan.syncMode === 'managed_market' && payload?.deactivateMissing !== false && plan.deactivateMissing !== false,
    activeMarketKeys: [...new Set((Array.isArray(plan.activeMarketKeys) ? plan.activeMarketKeys : []).map((value) => String(value || '').trim()).filter(Boolean))],
    runDate,
    runId: String(run.runId || '').trim() || `managed-sync-${runDate}-${Date.now().toString(36)}`,
    dryRun: run.dryRun === true || payload?.dryRun === true,
    planId: String(plan.planId || '').trim(),
    planHash: String(plan.planHash || '').trim(),
    payloadHash: String(plan.payloadHash || '').trim(),
    phase: String(execution.phase || '').trim() || (run.dryRun === true ? 'preview' : 'sync'),
    batchIndex: Number.isFinite(Number(execution.batchIndex)) ? Number(execution.batchIndex) : null,
    batchCount: Number.isFinite(Number(execution.batchCount)) ? Number(execution.batchCount) : null
  }
}

const summarizeManagedPost = (post) => ({
  id: post.id,
  title: post.title,
  price: Number(post.price || 0),
  tradeType: Number(post.trade_type || 0),
  categoryId: post.category_id || null,
  expireAt: post.expire_at || null,
  status: Number(post.status || 0)
})

const buildManagedRecentPostKey = (post) =>
  [post.categoryId || post.category_id || '', post.tradeType || post.trade_type || '', post.title || '']
    .map((value) => String(value || '').trim())
    .join('|')

const indexManagedRecentPosts = (rows = []) => {
  const index = new Map()
  for (const row of rows) {
    if (!isManagedAutoMarketPost(row)) continue
    const key = buildManagedRecentPostKey(row)
    if (!index.has(key)) {
      index.set(key, [])
    }
    index.get(key).push(row)
  }
  return index
}

const isManagedAutoMarketPost = (post) =>
  Boolean(post) &&
  typeof post.extra_info === 'string' &&
  (post.extra_info.startsWith(AUTO_MARKET_INFO_PREFIX) ||
    post.extra_info.startsWith(LEGACY_AUTO_MARKET_INFO_PREFIX))

const loadRecentOperatorMarketPosts = async ({ config, operatorId, categoryIds }) => {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) return []

  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
  const postsRes = await restRequest({
    config,
    resource: 'posts',
    query:
      `user_id=eq.${encodeURIComponent(operatorId)}` +
      `&category_id=in.(${categoryIds.map((id) => `"${id}"`).join(',')})` +
      `&created_at=gte.${encodeURIComponent(since)}` +
      '&select=id,title,price,trade_type,category_id,extra_info,status,expire_at,created_at,updated_at' +
      '&order=created_at.desc' +
      '&limit=200',
    useServiceRole: true
  })

  if (!postsRes.ok) {
    throw new Error(postsRes.text || 'Failed to load recent operator market posts')
  }

  return Array.isArray(postsRes.data) ? postsRes.data : []
}

const deactivateManagedMarketPosts = async ({ config, postIds }) => {
  if (!Array.isArray(postIds) || postIds.length === 0) return []

  const updateRes = await restRequest({
    config,
    resource: 'posts',
    query:
      `id=in.(${postIds.map((id) => `"${id}"`).join(',')})` +
      '&select=id,title,price,trade_type,category_id,extra_info,status,expire_at,created_at,updated_at',
    method: 'PATCH',
    body: {
      status: 0,
      expire_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    useServiceRole: true,
    extraHeaders: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  })

  if (!updateRes.ok) {
    throw new Error(updateRes.text || 'Failed to deactivate stale managed market posts')
  }

  return Array.isArray(updateRes.data) ? updateRes.data : []
}

const handleAdminWechatAutoPublish = async ({ request, config }) => {
  const missingServiceRoleResponse = requireServiceRole(config)
  if (missingServiceRoleResponse) return missingServiceRoleResponse

  try {
    const adminCheck = await verifyAdminRequest({ config, request })
    if (!adminCheck.ok) return adminCheck.response

    const payload = await readJsonBody(request)
    const syncRequest = normalizeManagedSyncRequest(payload || {})
    if (!syncRequest.ok) {
      return json(
        { success: false, error: { code: 'INVALID_MANAGED_SYNC_REQUEST', message: syncRequest.message } },
        400
      )
    }

    const {
      posts,
      syncMode,
      deactivateMissing,
      activeMarketKeys,
      runDate,
      dryRun,
      requestedUserId,
      kind,
      protocolVersion,
      runId,
      planId,
      planHash,
      payloadHash,
      phase,
      batchIndex,
      batchCount
    } = syncRequest
    const syncMeta = {
      kind,
      protocolVersion,
      runId,
      runDate,
      dryRun,
      planId,
      planHash,
      payloadHash,
      phase,
      batchIndex,
      batchCount
    }

    if (!posts.length && !(syncMode && deactivateMissing && activeMarketKeys.length)) {
      return json({ success: false, error: { code: 'EMPTY_POSTS', message: 'No posts provided.' } }, 400)
    }

    const operator = await resolveWechatAutoOperator({
      config,
      requestedUserId
    })

    const categoriesRes = await restRequest({
      config,
      resource: 'categories',
      query: 'select=id&is_active=eq.true',
      useServiceRole: true
    })

    if (!categoriesRes.ok) {
      throw new Error(categoriesRes.text || 'Failed to load active categories')
    }

    const activeCategoryIds = new Set((Array.isArray(categoriesRes.data) ? categoriesRes.data : []).map((row) => row.id))
    const failures = []
    const createdPosts = []
    const updatedPosts = []
    const refreshedPosts = []
    const deactivatedPosts = []
    const stateRows = []
    const historyRows = []
    const normalizedPosts = []
    const actions = []

    for (const rawPost of posts) {
      const normalized = normalizeWechatAutoPost(rawPost)
      if (!normalized.ok) {
        failures.push({
          title: String(rawPost?.title || '未命名帖子'),
          message: normalized.message
        })
        continue
      }

      const post = normalized.value
      if (!activeCategoryIds.has(post.categoryId)) {
        failures.push({
          title: post.title,
          message: 'categoryId does not match an active category.'
        })
        continue
      }

      normalizedPosts.push(post)
    }

    if (!syncMode) {
      const skippedPosts = []

      for (const post of normalizedPosts) {
        try {
          const existingPost = await findRecentAutoPublishedPost({
            config,
            operatorId: operator.id,
            post
          })

          if (existingPost?.id) {
            skippedPosts.push({
              id: existingPost.id,
              title: existingPost.title,
              price: Number(existingPost.price || 0),
              tradeType: Number(existingPost.trade_type || 0),
              categoryId: existingPost.category_id || null,
              expireAt: existingPost.expire_at || null,
              createdAt: existingPost.created_at || null
            })
            actions.push(
              buildManagedSyncAction({
                action: 'skip',
                marketKey: buildManagedMarketKey(post),
                requestedPost: post,
                currentPost: existingPost,
                reason: 'duplicate auto-published post already exists within 7 days',
                dryRun,
                status: 'skipped'
              })
            )
            continue
          }

          const expireAt = new Date(Date.now() + post.expireHours * 60 * 60 * 1000).toISOString()
          if (dryRun) {
            actions.push(
              buildManagedSyncAction({
                action: 'create',
                marketKey: buildManagedMarketKey(post),
                requestedPost: post,
                reason: 'new auto-publish post',
                dryRun
              })
            )
          } else {
            const createdPost = await insertManagedMarketPost({
              config,
              operatorId: operator.id,
              post,
              expireAt
            })

            createdPosts.push(createdPost)
            actions.push(
              buildManagedSyncAction({
                action: 'create',
                marketKey: buildManagedMarketKey(post),
                requestedPost: post,
                nextPost: createdPost,
                reason: 'new auto-publish post',
                dryRun
              })
            )
          }
        } catch (error) {
          failures.push({
            title: post.title,
            message: error?.message || 'Failed to create post.'
          })
        }
      }

      return json({
        success: true,
        data: {
          operatorUserId: operator.id,
          operatorWechatId: operator.wechat_id || '',
          dryRun,
          syncMeta,
          publishedCount: dryRun ? actions.filter((action) => action.action === 'create').length : createdPosts.length,
          skippedCount: skippedPosts.length,
          failedCount: failures.length,
          posts: createdPosts.map((post) => summarizeManagedPost(post)),
          skippedPosts,
          actions,
          failures
        }
      })
    }

    const stateKeys = normalizedPosts.map((post) => buildManagedStateSettingKey(buildManagedMarketKey(post)))
    const existingStateRows = await loadSystemSettingRowsByKeys(config, stateKeys)
    const existingStatePostIds = Object.values(existingStateRows)
      .map((row) => parseJsonValue(row?.value, {})?.postId)
      .filter((postId) => UUID_RE.test(postId || ''))
    const existingStatePostMap = await loadPostsByIds(config, existingStatePostIds)
    const recentCategoryIds = [...new Set(normalizedPosts.map((post) => post.categoryId))]
    const recentManagedPosts = recentCategoryIds.length
      ? await loadRecentOperatorMarketPosts({
          config,
          operatorId: operator.id,
          categoryIds: recentCategoryIds
        })
      : []
    const recentManagedPostIndex = indexManagedRecentPosts(recentManagedPosts)
    const claimedRecentPostIds = new Set()
    const touchedPostIds = new Set()

    for (const post of normalizedPosts) {
      const marketKey = buildManagedMarketKey(post)
      const stateKey = buildManagedStateSettingKey(marketKey)
      const existingState = parseJsonValue(existingStateRows[stateKey]?.value, {})
      const expireAt = new Date(Date.now() + post.expireHours * 60 * 60 * 1000).toISOString()

      let currentPost = UUID_RE.test(existingState?.postId || '') ? existingStatePostMap[existingState.postId] || null : null

      if (!currentPost) {
        const recentKey = buildManagedRecentPostKey(post)
        const recentCandidates = recentManagedPostIndex.get(recentKey) || []
        currentPost = recentCandidates.find((row) => !claimedRecentPostIds.has(row.id)) || null
        if (currentPost?.id) {
          claimedRecentPostIds.add(currentPost.id)
        }
      }

      try {
        if (!currentPost?.id) {
          if (dryRun) {
            actions.push(
              buildManagedSyncAction({
                action: 'create',
                marketKey,
                requestedPost: post,
                reason: 'no existing managed market post matched this market key',
                dryRun
              })
            )
            continue
          }

          const createdPost = await insertManagedMarketPost({
            config,
            operatorId: operator.id,
            post,
            expireAt
          })

          createdPosts.push(createdPost)
          touchedPostIds.add(createdPost.id)
          stateRows.push(buildManagedMarketStateRow({ marketKey, stateKey, post, postRow: createdPost, runDate, syncMeta }))
          historyRows.push(
            buildManagedHistoryRow({
              marketKey,
              action: 'create',
              payload: {
                syncMeta,
                next: summarizeManagedPost(createdPost),
                requested: {
                  title: post.title,
                  price: post.price,
                  tradeType: post.tradeType,
                  categoryId: post.categoryId
                }
              }
            })
          )
          actions.push(
            buildManagedSyncAction({
              action: 'create',
              marketKey,
              requestedPost: post,
              nextPost: createdPost,
              reason: 'no existing managed market post matched this market key',
              dryRun
            })
          )
          continue
        }

        const { payload: updatePayload, changedFields, shouldUpdate } = buildManagedPostUpdatePayload({
          currentPost,
          post,
          expireAt
        })

        touchedPostIds.add(currentPost.id)

        if (!shouldUpdate) {
          if (dryRun) {
            actions.push(
              buildManagedSyncAction({
                action: 'refresh',
                marketKey,
                requestedPost: post,
                currentPost,
                changedFields: [],
                reason: 'market key matched and content is unchanged',
                dryRun
              })
            )
            continue
          }

          refreshedPosts.push(currentPost)
          if (!existingState?.postId || existingState.postId !== currentPost.id) {
            stateRows.push(buildManagedMarketStateRow({ marketKey, stateKey, post, postRow: currentPost, runDate, syncMeta }))
          }
          actions.push(
            buildManagedSyncAction({
              action: 'refresh',
              marketKey,
              requestedPost: post,
              currentPost,
              changedFields: [],
              reason: 'market key matched and content is unchanged',
              dryRun
            })
          )
          continue
        }

        const actionType = changedFields.length ? 'update' : 'refresh'
        const actionReason = changedFields.length
          ? `replace stale fields: ${changedFields.join(', ')}`
          : 'only refresh expire_at for matched market key'

        if (dryRun) {
          actions.push(
            buildManagedSyncAction({
              action: actionType,
              marketKey,
              requestedPost: post,
              currentPost,
              changedFields,
              reason: actionReason,
              dryRun
            })
          )
          continue
        }

        const updatedPost = await updateManagedMarketPost({
          config,
          postId: currentPost.id,
          payload: updatePayload
        })

        if (!existingState?.postId || existingState.postId !== updatedPost.id || changedFields.length) {
          stateRows.push(buildManagedMarketStateRow({ marketKey, stateKey, post, postRow: updatedPost, runDate, syncMeta }))
        }

        if (changedFields.length) {
          updatedPosts.push(updatedPost)
          historyRows.push(
            buildManagedHistoryRow({
              marketKey,
              action: 'update',
              payload: {
                syncMeta,
                changedFields,
                previous: summarizeManagedPost(currentPost),
                next: summarizeManagedPost(updatedPost)
              }
            })
          )
        } else {
          refreshedPosts.push(updatedPost)
          historyRows.push(
            buildManagedHistoryRow({
              marketKey,
              action: 'refresh',
              payload: {
                syncMeta,
                previous: summarizeManagedPost(currentPost),
                next: summarizeManagedPost(updatedPost)
              }
            })
          )
        }
        actions.push(
          buildManagedSyncAction({
            action: actionType,
            marketKey,
            requestedPost: post,
            currentPost,
            nextPost: updatedPost,
            changedFields,
            reason: actionReason,
            dryRun
          })
        )
      } catch (error) {
        failures.push({
          title: post.title,
          message: error?.message || 'Failed to sync managed market post.'
        })
      }
    }

    if (!dryRun && stateRows.length) {
      await upsertSystemSettings(config, stateRows)
    }

    if (deactivateMissing && (normalizedPosts.length || activeMarketKeys.length) && failures.length === 0) {
      const deactivationStateKeys = (activeMarketKeys.length ? activeMarketKeys : normalizedPosts.map((post) => buildManagedMarketKey(post))).map((marketKey) =>
        buildManagedStateSettingKey(marketKey)
      )
      const deactivationStateRows = await loadSystemSettingRowsByKeys(config, deactivationStateKeys)
      const stateMarketKeyByPostId = new Map(
        Object.values(deactivationStateRows)
          .map((row) => parseJsonValue(row?.value, {}))
          .filter((row) => UUID_RE.test(row?.postId || ''))
          .map((row) => [row.postId, row.marketKey || ''])
      )
      const activePostIds = new Set(
        [
          ...touchedPostIds,
          ...Object.values(deactivationStateRows)
            .map((row) => parseJsonValue(row?.value, {})?.postId)
            .filter((postId) => UUID_RE.test(postId || ''))
        ].filter(Boolean)
      )
      const activePostMap = await loadPostsByIds(config, [...activePostIds])
      const categoryIdsForDeactivation = [...new Set(Object.values(activePostMap).map((row) => row?.category_id).filter(Boolean))]
      const recentPool =
        recentManagedPosts.length || categoryIdsForDeactivation.length === 0
          ? recentManagedPosts
          : await loadRecentOperatorMarketPosts({
              config,
              operatorId: operator.id,
              categoryIds: categoryIdsForDeactivation
            })
      const staleRows = recentPool.filter(
        (row) => Number(row.status || 0) === 1 && isManagedAutoMarketPost(row) && !activePostIds.has(row.id)
      )
      const staleIds = staleRows.map((row) => row.id)

      if (dryRun) {
        for (const row of staleRows) {
          actions.push(
            buildManagedSyncAction({
              action: 'deactivate',
              marketKey: stateMarketKeyByPostId.get(row.id) || '',
              currentPost: row,
              changedFields: ['status'],
              reason: 'post is missing from the latest confirmed market key set',
              dryRun
            })
          )
        }
      } else {
        const removed = await deactivateManagedMarketPosts({
          config,
          postIds: staleIds
        })

        deactivatedPosts.push(...removed)
        actions.push(
          ...removed.map((row) =>
            buildManagedSyncAction({
              action: 'deactivate',
              marketKey: stateMarketKeyByPostId.get(row.id) || '',
              currentPost: row,
              changedFields: ['status'],
              reason: 'post is missing from the latest confirmed market key set',
              dryRun
            })
          )
        )
        historyRows.push(
          ...removed.map((row) =>
            buildManagedHistoryRow({
              marketKey: stateMarketKeyByPostId.get(row.id) || `post:${row.id}`,
              action: 'deactivate',
              payload: {
                syncMeta,
                previous: summarizeManagedPost(row)
              }
            })
          )
        )
      }
    }

    if (!dryRun) {
      const actionCounts = {
        createCount: createdPosts.length,
        updateCount: updatedPosts.length,
        refreshCount: refreshedPosts.length,
        deactivateCount: deactivatedPosts.length
      }
      await upsertSystemSettings(config, [
        ...historyRows,
        buildManagedRunHistoryRow({
          syncMeta,
          counts: actionCounts,
          failures
        })
      ])
    }

    const actionCounts = {
      createCount: actions.filter((action) => action.action === 'create').length,
      updateCount: actions.filter((action) => action.action === 'update').length,
      refreshCount: actions.filter((action) => action.action === 'refresh').length,
      deactivateCount: actions.filter((action) => action.action === 'deactivate').length
    }

    return json({
      success: true,
      data: {
        operatorUserId: operator.id,
        operatorWechatId: operator.wechat_id || '',
        dryRun,
        syncMeta,
        publishedCount: dryRun ? actionCounts.createCount : createdPosts.length,
        updatedCount: dryRun ? actionCounts.updateCount : updatedPosts.length,
        refreshedCount: dryRun ? actionCounts.refreshCount : refreshedPosts.length,
        deactivatedCount: dryRun ? actionCounts.deactivateCount : deactivatedPosts.length,
        failedCount: failures.length,
        posts: [...createdPosts, ...updatedPosts, ...refreshedPosts].map((post) => summarizeManagedPost(post)),
        createdPosts: createdPosts.map((post) => summarizeManagedPost(post)),
        updatedPosts: updatedPosts.map((post) => summarizeManagedPost(post)),
        refreshedPosts: refreshedPosts.map((post) => summarizeManagedPost(post)),
        deactivatedPosts: deactivatedPosts.map((post) => summarizeManagedPost(post)),
        actions,
        failures
      }
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'ADMIN_WECHAT_AUTO_PUBLISH_ERROR',
          message: error?.message || 'Failed to auto publish WeChat posts.'
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

const sanitizeUserForClient = (user) => {
  if (!user) return null

  return {
    id: user.id,
    phone: user.phone,
    wechat_id: user.wechat_id || '',
    invite_code: user.invite_code || '',
    invited_by: user.invited_by || null,
    points: Number(user.points || 0),
    success_rate: Number(user.success_rate ?? user.deal_rate ?? 0),
    deal_rate: Number(user.deal_rate ?? user.success_rate ?? 0),
    total_posts: Number(user.total_posts || 0),
    total_deals: Number(user.total_deals || 0),
    total_invites: Number(user.total_invites || 0),
    is_admin: Boolean(user.is_admin),
    status: Number(user.status ?? 1),
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at
  }
}

const buildUserSelect = (includePassword = false) =>
  [
    'id',
    'phone',
    'wechat_id',
    'invite_code',
    'invited_by',
    'points',
    'deal_rate',
    'total_posts',
    'total_deals',
    'total_invites',
    'is_admin',
    'status',
    'created_at',
    'updated_at',
    includePassword ? 'password' : null
  ]
    .filter(Boolean)
    .join(',')

const loadUserByPhone = async ({ config, phone, includePassword = false }) => {
  const userRes = await restRequest({
    config,
    resource: 'users',
    query:
      `phone=eq.${encodeURIComponent(phone)}` +
      `&select=${buildUserSelect(includePassword)}` +
      '&limit=1',
    useServiceRole: true
  })

  if (!userRes.ok) {
    throw new Error(userRes.text || 'Failed to load user by phone')
  }

  return userRes.data?.[0] || null
}

const loadUserByInviteCode = async ({ config, inviteCode }) => {
  const inviterRes = await restRequest({
    config,
    resource: 'users',
    query:
      `invite_code=eq.${encodeURIComponent(inviteCode)}` +
      `&select=${buildUserSelect(false)}` +
      '&limit=1',
    useServiceRole: true
  })

  if (!inviterRes.ok) {
    throw new Error(inviterRes.text || 'Failed to load inviter')
  }

  return inviterRes.data?.[0] || null
}

const generateInviteCodeCandidate = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let inviteCode = ''

  for (let index = 0; index < 6; index += 1) {
    inviteCode += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return inviteCode
}

const generateUniqueInviteCode = async (config) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inviteCode = generateInviteCodeCandidate()
    const existingUser = await loadUserByInviteCode({ config, inviteCode })
    if (!existingUser) {
      return inviteCode
    }
  }

  throw new Error('Failed to generate a unique invite code')
}

const hashPassword = async (password, existingSalt = '') => {
  const saltBytes = new Uint8Array(16)
  const salt =
    existingSalt ||
    Array.from(crypto.getRandomValues(saltBytes))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')

  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${password}${salt}`))
  const hash = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')

  return `${salt}:${hash}`
}

const verifyStoredPassword = async (password, storedPassword) => {
  if (typeof storedPassword !== 'string' || !storedPassword.trim()) return false

  if (!storedPassword.includes(':')) {
    return storedPassword === password
  }

  const [salt] = storedPassword.split(':')
  if (!salt) return false

  return (await hashPassword(password, salt)) === storedPassword
}

const createUserRecord = async ({ config, payload }) => {
  const createRes = await restRequest({
    config,
    resource: 'users',
    query: `select=${buildUserSelect(false)}`,
    method: 'POST',
    body: payload,
    useServiceRole: true,
    extraHeaders: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  })

  if (!createRes.ok) {
    throw new Error(createRes.text || 'Failed to create user')
  }

  return createRes.data?.[0] || null
}

const cleanupUserRegistration = async ({ config, userId }) => {
  if (!UUID_RE.test(userId || '')) return

  await Promise.allSettled([
    restRequest({
      config,
      resource: 'point_transactions',
      query: `user_id=eq.${encodeURIComponent(userId)}`,
      method: 'DELETE',
      useServiceRole: true,
      extraHeaders: {
        Prefer: 'return=minimal'
      }
    }),
    restRequest({
      config,
      resource: 'invitations',
      query: `invitee_id=eq.${encodeURIComponent(userId)}`,
      method: 'DELETE',
      useServiceRole: true,
      extraHeaders: {
        Prefer: 'return=minimal'
      }
    }),
    restRequest({
      config,
      resource: 'users',
      query: `id=eq.${encodeURIComponent(userId)}`,
      method: 'DELETE',
      useServiceRole: true,
      extraHeaders: {
        Prefer: 'return=minimal'
      }
    })
  ])
}

const handlePasswordLogin = async ({ request, config }) => {
  const missingServiceRoleResponse = requireServiceRole(config)
  if (missingServiceRoleResponse) return missingServiceRoleResponse

  const payload = await readJsonBody(request)
  const phone = typeof payload?.phone === 'string' ? payload.phone.trim() : ''
  const password = typeof payload?.password === 'string' ? payload.password : ''

  if (!phone || !password) {
    return json({ success: false, error: { code: 'INVALID_PAYLOAD', message: '请输入手机号和密码。' } }, 400)
  }

  try {
    const user = await loadUserByPhone({ config, phone, includePassword: true })
    if (!user) {
      return json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: '手机号或密码错误。' } }, 401)
    }

    if (Number(user.status ?? 1) === 0) {
      return json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: '账号已被禁用，请联系管理员。' } }, 403)
    }

    const isPasswordValid = await verifyStoredPassword(password, user.password)
    if (!isPasswordValid) {
      return json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: '手机号或密码错误。' } }, 401)
    }

    return json({
      success: true,
      data: {
        user: sanitizeUserForClient(user),
        message: '登录成功'
      }
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'PASSWORD_LOGIN_ERROR',
          message: error?.message || '密码登录失败。'
        }
      },
      500
    )
  }
}

const handlePasswordRegistration = async ({ request, config }) => {
  const missingServiceRoleResponse = requireServiceRole(config)
  if (missingServiceRoleResponse) return missingServiceRoleResponse

  const payload = await readJsonBody(request)
  const phone = typeof payload?.phone === 'string' ? payload.phone.trim() : ''
  const password = typeof payload?.password === 'string' ? payload.password : ''
  const wechatId = typeof payload?.wechat_id === 'string' ? payload.wechat_id.trim() : ''
  const inviteCode = typeof payload?.invite_code === 'string' ? payload.invite_code.trim().toUpperCase() : ''

  if (!phone || !password || !wechatId) {
    return json({ success: false, error: { code: 'INVALID_PAYLOAD', message: '请填写完整的注册信息。' } }, 400)
  }

  if (!PHONE_RE.test(phone)) {
    return json({ success: false, error: { code: 'INVALID_PHONE', message: '请输入正确的手机号。' } }, 400)
  }

  if (password.length < 6 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
    return json(
      {
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: '密码至少 6 位，且必须同时包含数字和字母。'
        }
      },
      400
    )
  }

  if (inviteCode && !INVITE_CODE_RE.test(inviteCode)) {
    return json({ success: false, error: { code: 'INVALID_INVITE_CODE', message: '邀请码格式不正确。' } }, 400)
  }

  let createdUserId = ''

  try {
    const existingUser = await loadUserByPhone({ config, phone, includePassword: false })
    if (existingUser) {
      return json({ success: false, error: { code: 'PHONE_ALREADY_EXISTS', message: '该手机号已注册。' } }, 409)
    }

    let inviter = null
    if (inviteCode) {
      inviter = await loadUserByInviteCode({ config, inviteCode })
      if (!inviter) {
        return json({ success: false, error: { code: 'INVALID_INVITE_CODE', message: '邀请码无效。' } }, 400)
      }
    }

    const userInviteCode = await generateUniqueInviteCode(config)
    const hashedPassword = await hashPassword(password)
    const createdUser = await createUserRecord({
      config,
      payload: {
        phone,
        password: hashedPassword,
        wechat_id: wechatId,
        invite_code: userInviteCode,
        invited_by: inviter?.invite_code || null,
        points: INITIAL_REGISTRATION_POINTS,
        status: 1
      }
    })

    if (!createdUser?.id) {
      throw new Error('Failed to create user record')
    }

    createdUserId = createdUser.id

    await insertPointTransaction(config, {
      user_id: createdUser.id,
      change_type: POINT_CHANGE_TYPES.registration,
      change_amount: INITIAL_REGISTRATION_POINTS,
      balance_after: INITIAL_REGISTRATION_POINTS,
      related_id: createdUser.id,
      description: '注册奖励',
      created_at: new Date().toISOString()
    })

    if (inviter?.invite_code) {
      const invitationRes = await restRequest({
        config,
        resource: 'invitations',
        method: 'POST',
        body: {
          inviter_code: inviter.invite_code,
          invitee_id: createdUser.id,
          has_posted: false,
          reward_sent: false,
          created_at: new Date().toISOString()
        },
        useServiceRole: true,
        extraHeaders: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        }
      })

      if (!invitationRes.ok) {
        throw new Error(invitationRes.text || 'Failed to create invitation relationship')
      }
    }

    return json({
      success: true,
      data: {
        user: sanitizeUserForClient(createdUser),
        message: '注册成功'
      }
    })
  } catch (error) {
    if (createdUserId) {
      await cleanupUserRegistration({ config, userId: createdUserId })
    }

    return json(
      {
        success: false,
        error: {
          code: 'PASSWORD_REGISTRATION_ERROR',
          message: error?.message || '注册失败。'
        }
      },
      500
    )
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
            '&select=id,phone,wechat_id,total_posts,points,is_admin',
          useServiceRole: true
        })

        if (!usersRes.ok) {
          throw new Error(usersRes.text || 'Failed to load leaderboard users')
        }

        const users = Array.isArray(usersRes.data) ? usersRes.data : []
        entries = users
          .filter((item) => !item.is_admin)
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
        query: 'select=id,phone,wechat_id,total_posts,points,is_admin&limit=50',
        useServiceRole: true
      })

      if (!usersRes.ok) {
        throw new Error(usersRes.text || 'Failed to load all-time leaderboard users')
      }

      entries = (Array.isArray(usersRes.data) ? usersRes.data : [])
        .filter((item) => !item.is_admin)
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
    request.method === 'POST' &&
    pathSegments[0] === 'admin' &&
    pathSegments[1] === 'wechat-auto-publish'
  ) {
    return handleAdminWechatAutoPublish({ request, config })
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

  if (request.method === 'POST' && pathSegments[0] === 'auth' && pathSegments[1] === 'login-with-password') {
    return handlePasswordLogin({ request, config })
  }

  if (request.method === 'POST' && pathSegments[0] === 'auth' && pathSegments[1] === 'register-with-password') {
    return handlePasswordRegistration({ request, config })
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
