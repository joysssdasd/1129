// 老王我给你写清楚所有的数据类型，让你这个技术小白能看懂！

/**
 * 用户相关类型
 */
export interface User {
  id: string
  phone: string
  wechat_id?: string
  invite_code: string
  points: number
  success_rate: number
  is_admin: boolean
  created_at: string
  updated_at: string
}

/**
 * 交易帖子类型
 */
export interface Post {
  id: string
  user_id: string
  title: string
  keywords: string
  price: number
  trade_type: 'transfer' | 'request'
  delivery_time: string
  description?: string
  view_count: number
  views_remaining: number
  status: 'active' | 'inactive' | 'completed'
  created_at: string
  updated_at: string
  // 关联数据
  user?: User
}

/**
 * 充值请求类型
 */
export interface RechargeRequest {
  id: string
  user_id: string
  amount: number
  package_info?: string
  status: 'pending' | 'completed' | 'failed'
  payment_method?: 'alipay' | 'wechat'
  created_at: string
}

/**
 * 支付二维码类型
 */
export interface PaymentQRCode {
  id: string
  user_id: string
  type: 'alipay' | 'wechat'
  qr_code_url: string
  is_active: boolean
  created_at: string
}

/**
 * 查看记录类型
 */
export interface ViewRecord {
  id: string
  user_id: string
  post_id: string
  points_cost: number
  created_at: string
}

/**
 * API响应类型
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * 分页请求参数
 */
export interface PaginationParams {
  page: number
  limit: number
  search?: string
  trade_type?: 'transfer' | 'request'
}

/**
 * 分页响应数据
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/**
 * 发布帖子的表单数据
 */
export interface CreatePostData {
  title: string
  keywords: string
  price: number
  trade_type: 'transfer' | 'request'
  delivery_time: string
  description?: string
}

/**
 * 用户注册/登录数据
 */
export interface AuthData {
  phone: string
  code: string
  invite_code?: string
}

/**
 * 用户更新数据
 */
export interface UpdateUserData {
  wechat_id?: string
}

/**
 * 验证码发送响应
 */
export interface SendCodeResponse {
  success: boolean
  message: string
  dev_code?: string // 开发环境显示的验证码
}

/**
 * 关键词价格视图类型
 */
export interface KeywordPrice {
  keywords: string
  avg_price: number
  post_count: number
}

/**
 * 统计数据类型
 */
export interface Statistics {
  total_users: number
  total_posts: number
  active_posts: number
  total_views: number
  total_revenue: number
}

// 表单验证规则类型
export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  message?: string
}

// UI状态类型
export interface LoadingState {
  isLoading: boolean
  message?: string
}

export interface ErrorState {
  hasError: boolean
  message?: string
  code?: string
}