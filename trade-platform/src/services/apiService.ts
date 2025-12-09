/**
 * 老王我给你写个超级好用的API服务，让技术小白也能轻松管理所有网络请求！
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  User,
  Post,
  RechargeRequest,
  PaymentQRCode,
  ViewRecord,
  CreatePostData,
  AuthData,
  UpdateUserData,
  PaginationParams,
  PaginatedResponse,
  ApiResponse
} from '@/types';
import {
  API_ENDPOINTS,
  PAGINATION,
  STORAGE_KEYS,
  ERROR_CODES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
} from '@/constants';
import {
  errorHandler,
  handleError,
  NetworkError,
  ApiError,
  withErrorHandling
} from './errorHandler';
import { toast } from './toastService';
import { log } from '@/utils/logger';

/**
 * API配置
 */
const API_CONFIG = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key',
  timeout: 30000, // 30秒超时
  retryAttempts: 3,
  retryDelay: 1000, // 1秒重试延迟
};

/**
 * 基础API类
 */
class BaseApiService {
  protected supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      API_CONFIG.supabaseUrl,
      API_CONFIG.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          storageKey: STORAGE_KEYS.AUTH_TOKEN,
        },
      }
    );
  }

  /**
   * 通用请求方法
   */
  protected async request<T>(
    operation: () => Promise<T>,
    errorMessage?: string
  ): Promise<T> {
    try {
      return await withErrorHandling(operation, (error) => {
        toast.error(error.message, errorMessage || '请求失败');
      })();
    } catch (error) {
      throw handleError(error, errorMessage);
    }
  }

  /**
   * 处理Supabase响应
   */
  protected handleResponse<T>(response: any): T {
    if (response.error) {
      throw new ApiError(
        response.error.message || ERROR_MESSAGES.SERVER_ERROR,
        ERROR_CODES.SERVER_ERROR,
        response.error.code || 500,
        response.error
      );
    }
    return response.data;
  }

  /**
   * 分页查询辅助方法
   */
  protected buildPaginationQuery(params: PaginationParams) {
    const query = this.supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    // 搜索
    if (params.search) {
      query.or(`title.ilike.%${params.search}%,keywords.ilike.%${params.search}%`);
    }

    // 交易类型筛选
    if (params.trade_type) {
      query.eq('trade_type', params.trade_type);
    }

    // 分页
    const offset = (params.page - 1) * params.limit;
    query.range(offset, offset + params.limit - 1);

    return query;
  }
}

/**
 * 用户认证服务
 */
export class AuthService extends BaseApiService {
  /**
   * 发送验证码
   */
  async sendCode(phone: string): Promise<{ success: boolean; dev_code?: string }> {
    return this.request(async () => {
      // 开发环境直接返回验证码
      if (import.meta.env.DEV) {
        const devCode = '123456'; // 开发环境固定验证码
        log.log(`📱 开发环境验证码: ${devCode}`);
        return { success: true, dev_code: devCode };
      }

      // 生产环境调用短信服务
      const { data, error } = await this.supabase.functions.invoke('send-sms-code', {
        body: { phone },
      });

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.SERVER_ERROR, 500);
      }

      return { success: true };
    }, ERROR_MESSAGES.NETWORK_ERROR);
  }

  /**
   * 验证码登录/注册
   */
  async verifyCode(phone: string, code: string, inviteCode?: string): Promise<User> {
    return this.request(async () => {
      // 开发环境验证码处理
      if (import.meta.env.DEV && code !== '123456') {
        throw new ApiError(ERROR_MESSAGES.INVALID_CODE, ERROR_CODES.VALIDATION_ERROR, 400);
      }

      // 调用登录函数
      const { data, error } = await this.supabase.functions.invoke('auth-login', {
        body: { phone, code, invite_code: inviteCode },
      });

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.UNAUTHORIZED, 401);
      }

      if (!data.user) {
        throw new ApiError(ERROR_MESSAGES.INVALID_PHONE, ERROR_CODES.UNAUTHORIZED, 401);
      }

      toast.success(SUCCESS_MESSAGES.LOGIN_SUCCESS);
      return data.user;
    }, '登录失败');
  }

  /**
   * 获取当前用户
   */
  async getCurrentUser(): Promise<User | null> {
    return this.request(async () => {
      const { data: { user }, error } = await this.supabase.auth.getUser();

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.UNAUTHORIZED, 401);
      }

      if (!user) {
        return null;
      }

      // 获取用户详细信息
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        throw new ApiError(userError.message, ERROR_CODES.SERVER_ERROR, 500);
      }

      return userData;
    });
  }

  /**
   * 更新用户信息
   */
  async updateUser(updates: UpdateUserData): Promise<User> {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from('users')
        .update(updates)
        .eq('id', (await this.supabase.auth.getUser()).data.user?.id)
        .select()
        .single();

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.VALIDATION_ERROR, 400);
      }

      toast.success(SUCCESS_MESSAGES.USER_UPDATED);
      return data;
    }, '更新用户信息失败');
  }

  /**
   * 退出登录
   */
  async logout(): Promise<void> {
    return this.request(async () => {
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        throw new ApiError(error.message, ERROR_CODES.SERVER_ERROR, 500);
      }
    }, '退出登录失败');
  }
}

/**
 * 帖子服务
 */
export class PostService extends BaseApiService {
  /**
   * 获取帖子列表
   */
  async getPosts(params: PaginationParams): Promise<PaginatedResponse<Post>> {
    return this.request(async () => {
      const query = this.buildPaginationQuery(params);
      const { data, error, count } = await query;

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.SERVER_ERROR, 500);
      }

      return {
        data: data || [],
        total: count || 0,
        page: params.page,
        limit: params.limit,
        hasMore: (data?.length || 0) >= params.limit,
      };
    }, '获取帖子列表失败');
  }

  /**
   * 创建帖子
   */
  async createPost(postData: CreatePostData): Promise<Post> {
    return this.request(async () => {
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) {
        throw new ApiError('请先登录', ERROR_CODES.UNAUTHORIZED, 401);
      }

      const { data, error } = await this.supabase
        .from('posts')
        .insert({
          ...postData,
          user_id: user.id,
          view_count: 0,
          views_remaining: 10, // 发布后获得10次查看机会
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.VALIDATION_ERROR, 400);
      }

      toast.success(SUCCESS_MESSAGES.POST_CREATED);
      return data;
    }, '发布帖子失败');
  }

  /**
   * 获取帖子详情
   */
  async getPostDetail(postId: string): Promise<Post> {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from('posts')
        .select(`
          *,
          user:users(id, phone, wechat_id, invite_code, success_rate)
        `)
        .eq('id', postId)
        .single();

      if (error) {
        throw new ApiError(ERROR_MESSAGES.POST_NOT_FOUND, ERROR_CODES.POST_NOT_FOUND, 404);
      }

      return data;
    }, '获取帖子详情失败');
  }

  /**
   * 查看联系方式
   */
  async viewContact(postId: string): Promise<{ wechat_id: string }> {
    return this.request(async () => {
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) {
        throw new ApiError('请先登录', ERROR_CODES.UNAUTHORIZED, 401);
      }

      // 调用查看联系方式的函数
      const { data, error } = await this.supabase.functions.invoke('view-contact', {
        body: { post_id: postId, user_id: user.id },
      });

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.FORBIDDEN, 403);
      }

      return data;
    }, '查看联系方式失败');
  }

  /**
   * 确认交易
   */
  async confirmDeal(postId: string, isCompleted: boolean): Promise<void> {
    return this.request(async () => {
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) {
        throw new ApiError('请先登录', ERROR_CODES.UNAUTHORIZED, 401);
      }

      const { error } = await this.supabase.functions.invoke('confirm-deal', {
        body: {
          post_id: postId,
          user_id: user.id,
          is_completed: isCompleted
        },
      });

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.SERVER_ERROR, 500);
      }

      toast.success(isCompleted ? '交易确认成功' : '已标记为未成交');
    }, '确认交易失败');
  }

  /**
   * 下架帖子
   */
  async deactivatePost(postId: string): Promise<void> {
    return this.request(async () => {
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) {
        throw new ApiError('请先登录', ERROR_CODES.UNAUTHORIZED, 401);
      }

      const { error } = await this.supabase
        .from('posts')
        .update({ status: 'inactive' })
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.FORBIDDEN, 403);
      }

      toast.success('帖子已下架');
    }, '下架帖子失败');
  }
}

/**
 * 充值服务
 */
export class RechargeService extends BaseApiService {
  /**
   * 创建充值订单
   */
  async createRecharge(amount: number, paymentMethod: 'alipay' | 'wechat'): Promise<RechargeRequest> {
    return this.request(async () => {
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) {
        throw new ApiError('请先登录', ERROR_CODES.UNAUTHORIZED, 401);
      }

      const { data, error } = await this.supabase
        .from('recharge_requests')
        .insert({
          user_id: user.id,
          amount,
          payment_method: paymentMethod,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.VALIDATION_ERROR, 400);
      }

      toast.success('充值订单已创建');
      return data;
    }, '创建充值订单失败');
  }

  /**
   * 获取充值记录
   */
  async getRechargeHistory(): Promise<RechargeRequest[]> {
    return this.request(async () => {
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) {
        throw new ApiError('请先登录', ERROR_CODES.UNAUTHORIZED, 401);
      }

      const { data, error } = await this.supabase
        .from('recharge_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.SERVER_ERROR, 500);
      }

      return data || [];
    }, '获取充值记录失败');
  }
}

/**
 * 管理员服务
 */
export class AdminService extends BaseApiService {
  /**
   * 获取所有用户
   */
  async getAllUsers(): Promise<User[]> {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.FORBIDDEN, 403);
      }

      return data || [];
    }, '获取用户列表失败');
  }

  /**
   * 获取所有帖子
   */
  async getAllPosts(): Promise<Post[]> {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from('posts')
        .select('*, user:users(id, phone, wechat_id)')
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.FORBIDDEN, 403);
      }

      return data || [];
    }, '获取帖子列表失败');
  }

  /**
   * 获取统计数据
   */
  async getStatistics(): Promise<any> {
    return this.request(async () => {
      const { data, error } = await this.supabase.functions.invoke('get-statistics');

      if (error) {
        throw new ApiError(error.message, ERROR_CODES.FORBIDDEN, 403);
      }

      return data;
    }, '获取统计数据失败');
  }
}

/**
 * 统一的API服务实例
 */
export class ApiService {
  public readonly auth = new AuthService();
  public readonly posts = new PostService();
  public readonly recharge = new RechargeService();
  public readonly admin = new AdminService();

  constructor() {
    // 注册全局错误处理
    errorHandler.onError((error) => {
      if (error instanceof NetworkError) {
        toast.error('网络连接失败，请检查网络设置');
      } else if (error instanceof ApiError && error.statusCode === 401) {
        toast.error('登录已过期，请重新登录');
        // 可以在这里触发自动登出
      }
    });
  }

  /**
   * 初始化API服务
   */
  async initialize(): Promise<void> {
    try {
      // 检查用户登录状态
      const user = await this.auth.getCurrentUser();
      log.log('API服务初始化成功，用户状态:', user ? '已登录' : '未登录');
    } catch (error) {
      log.error('API服务初始化失败:', error);
    }
  }
}

/**
 * 全局API服务实例
 */
export const apiService = new ApiService();

/**
 * 便捷的Hook
 */
export const useApi = () => {
  return apiService;
};

export default apiService;