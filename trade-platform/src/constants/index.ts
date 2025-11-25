// 老王我把所有常量都写在这里，方便你这个技术小白修改！

/**
 * API相关常量
 */
export const API_ENDPOINTS = {
  // 用户相关
  SEND_CODE: '/auth/send-code',
  VERIFY_CODE: '/auth/verify-code',
  UPDATE_USER: '/user/update',

  // 帖子相关
  GET_POSTS: '/posts',
  CREATE_POST: '/posts',
  GET_POST_DETAIL: '/posts/:id',
  VIEW_CONTACT: '/posts/:id/contact',
  CONFIRM_DEAL: '/posts/:id/confirm',

  // 充值相关
  CREATE_RECHARGE: '/recharge',
  GET_RECHARGE_HISTORY: '/recharge/history',

  // 管理员相关
  GET_ALL_USERS: '/admin/users',
  GET_ALL_POSTS: '/admin/posts',
  GET_STATISTICS: '/admin/stats',
} as const

/**
 * 本地存储键名
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_INFO: 'user_info',
  THEME: 'theme',
  LANGUAGE: 'language',
  LAST_ACTIVITY: 'last_activity'
} as const

/**
 * 分页配置
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

/**
 * 积分配置
 */
export const POINTS = {
  PUBLISH_POST_COST: 10,
  VIEW_CONTACT_COST: 1,
  INVITE_REWARD: 10,
  INITIAL_POINTS: 20,
  RECHARGE_PACKAGES: [
    { amount: 10, points: 100, bonus: 0 },
    { amount: 25, points: 250, bonus: 20 },
    { amount: 50, points: 500, bonus: 50 },
    { amount: 100, points: 1000, bonus: 150 }
  ]
} as const

/**
 * 时间配置
 */
export const TIME = {
  VERIFICATION_CODE_EXPIRY: 5 * 60 * 1000, // 5分钟
  POST_AUTO_HIDE: 72 * 60 * 60 * 1000, // 72小时
  DEAL_CONFIRM_DELAY: 24 * 60 * 60 * 1000, // 24小时
  TOKEN_REFRESH_INTERVAL: 30 * 60 * 1000, // 30分钟
} as const

/**
 * 验证规则
 */
export const VALIDATION = {
  PHONE: {
    pattern: /^1[3-9]\d{9}$/,
    message: '请输入正确的手机号码'
  },
  CODE: {
    pattern: /^\d{6}$/,
    message: '验证码必须是6位数字'
  },
  INVITE_CODE: {
    pattern: /^[A-Z0-9]{6}$/,
    message: '邀请码必须是6位大写字母和数字'
  },
  TITLE: {
    minLength: 5,
    maxLength: 100,
    message: '标题长度必须在5-100字符之间'
  },
  KEYWORDS: {
    minLength: 2,
    maxLength: 50,
    message: '关键词长度必须在2-50字符之间'
  },
  DESCRIPTION: {
    maxLength: 500,
    message: '描述不能超过500字符'
  },
  WECHAT_ID: {
    minLength: 5,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: '微信号格式不正确'
  }
} as const

/**
 * UI配置
 */
export const UI = {
  TOAST_DURATION: 3000, // 3秒
  DEBOUNCE_DELAY: 500, // 500ms防抖
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
} as const

/**
 * 状态枚举
 */
export const POST_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  COMPLETED: 'completed',
  EXPIRED: 'expired',  // 3天后自动下架状态
} as const

export const HIDE_REASON = {
  AUTO_EXPIRED: 'auto_expired',  // 3天自动到期
  MANUAL: 'manual',              // 用户手动下架
  ADMIN_HIDDEN: 'admin_hidden',  // 管理员强制下架
} as const

export const TRADE_TYPE = {
  TRANSFER: 'transfer',
  REQUEST: 'request',
} as const

export const RECHARGE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export const PAYMENT_METHOD = {
  ALIPAY: 'alipay',
  WECHAT: 'wechat',
} as const

/**
 * 错误代码
 */
export const ERROR_CODES = {
  // 网络错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',

  // 认证错误
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // 权限错误
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',

  // 业务错误
  POST_NOT_FOUND: 'POST_NOT_FOUND',
  ALREADY_VIEWED: 'ALREADY_VIEWED',
  INVALID_INVITE_CODE: 'INVALID_INVITE_CODE',
  PHONE_ALREADY_EXISTS: 'PHONE_ALREADY_EXISTS',

  // 服务器错误
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const

/**
 * 成功消息
 */
export const SUCCESS_MESSAGES = {
  CODE_SENT: '验证码已发送',
  LOGIN_SUCCESS: '登录成功',
  REGISTER_SUCCESS: '注册成功',
  POST_CREATED: '发布成功',
  POST_UPDATED: '更新成功',
  POST_DELETED: '删除成功',
  USER_UPDATED: '信息更新成功',
  RECHARGE_CREATED: '充值请求已创建',
} as const

/**
 * 错误消息
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络',
  INVALID_PHONE: '手机号码格式不正确',
  INVALID_CODE: '验证码错误',
  CODE_EXPIRED: '验证码已过期',
  INSUFFICIENT_POINTS: '积分不足',
  POST_NOT_FOUND: '帖子不存在',
  ALREADY_VIEWED: '您已经查看过此联系方式',
  INVALID_INVITE_CODE: '邀请码无效',
  PHONE_ALREADY_EXISTS: '该手机号已注册',
  UPLOAD_FAILED: '上传失败',
  SERVER_ERROR: '服务器错误，请稍后重试',
  TIMEOUT_ERROR: '请求超时',
  CONNECTION_ERROR: '网络连接失败',
} as const

/**
 * 开发环境配置
 */
export const DEV_CONFIG = {
  SHOW_VERIFICATION_CODE: true, // 开发环境显示验证码
  ENABLE_MOCK_DATA: false, // 是否启用模拟数据
  LOG_API_CALLS: true, // 是否记录API调用
} as const

/**
 * 路由路径
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  PUBLISH: '/publish',
  POST_DETAIL: '/post/:id',
  PROFILE: '/profile',
  ADMIN: '/admin',
  RECHARGE: '/recharge',
} as const