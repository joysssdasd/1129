/**
 * 老王我给你写的自动下架服务，让3天后到期的帖子自动下架！
 * 包括管理员发布的帖子，一视同仁！
 */

import { supabase } from './supabase';
import { TIME, POST_STATUS, HIDE_REASON } from '../constants';
import { log } from '../utils/logger';

export class AutoHideService {
  private static instance: AutoHideService;
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): AutoHideService {
    if (!AutoHideService.instance) {
      AutoHideService.instance = new AutoHideService();
    }
    return AutoHideService.instance;
  }

  /**
   * 启动自动下架检查服务
   */
  startAutoHideCheck(): void {
    if (this.intervalId) {
      log.log('自动下架检查服务已在运行');
      return;
    }

    log.log('🤖 启动自动下架检查服务');

    // 立即执行一次
    this.checkAndHideExpiredPosts();

    // 每小时检查一次
    this.intervalId = setInterval(() => {
      this.checkAndHideExpiredPosts();
    }, 60 * 60 * 1000); // 1小时检查一次
  }

  /**
   * 停止自动下架检查服务
   */
  stopAutoHideCheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.log('⏹️ 自动下架检查服务已停止');
    }
  }

  /**
   * 从数据库获取帖子有效期天数
   */
  private async getExpireDays(): Promise<number> {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'post_expire_days')
        .single();
      
      return data ? parseInt(data.value) || 3 : 3;
    } catch {
      return 3; // 默认3天
    }
  }

  /**
   * 检查并下架过期帖子
   */
  private async checkAndHideExpiredPosts(): Promise<void> {
    try {
      log.log('🔍 开始检查过期的交易帖子...');

      // 从数据库获取有效期设置
      const expireDays = await this.getExpireDays();
      const expireTime = expireDays * 24 * 60 * 60 * 1000;
      const expireDate = new Date(Date.now() - expireTime);

      // 查询所有需要下架的活跃帖子（包括管理员发布的）
      const { data: expiredPosts, error } = await supabase
        .from('posts')
        .select('id, user_id, title, created_at, status')
        .eq('status', POST_STATUS.ACTIVE)
        .lt('created_at', expireDate.toISOString());

      if (error) {
        log.error('❌ 查询过期帖子失败:', error);
        return;
      }

      if (!expiredPosts || expiredPosts.length === 0) {
        log.log('✅ 没有过期的帖子需要处理');
        return;
      }

      log.log(`📦 发现 ${expiredPosts.length} 个过期帖子，开始自动下架...`);

      // 批量下架过期帖子
      for (const post of expiredPosts) {
        await this.hideExpiredPost(post.id, post.user_id);
      }

      log.log(`✅ 成功下架 ${expiredPosts.length} 个过期帖子`);

    } catch (error) {
      log.error('❌ 自动下架检查失败:', error);
    }
  }

  /**
   * 下架单个过期帖子
   */
  private async hideExpiredPost(postId: string, userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('posts')
        .update({
          status: POST_STATUS.EXPIRED,
          updated_at: now,
          auto_hide_at: now,
          hide_reason: HIDE_REASON.AUTO_EXPIRED,
          is_manually_hidden: false
        })
        .eq('id', postId);

      if (error) {
        log.error(`❌ 下架帖子 ${postId} 失败:`, error);
        return;
      }

      log.log(`🗑️ 帖子 ${postId} 已自动下架（3天到期）`);

      // 记录下架日志
      await this.logHideAction(postId, userId, HIDE_REASON.AUTO_EXPIRED);

    } catch (error) {
      log.error(`❌ 下架帖子 ${postId} 时发生错误:`, error);
    }
  }

  /**
   * 手动下架帖子并返还积分
   */
  async manuallyHidePost(postId: string, userId: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();

      // 先获取帖子信息，计算需要返还的积分
      const { data: postData, error: fetchError } = await supabase
        .from('posts')
        .select('view_count, views_remaining')
        .eq('id', postId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !postData) {
        log.error(`❌ 获取帖子信息失败:`, fetchError);
        return false;
      }

      // 计算剩余可查看次数
      const remainingViews = Math.max(0, postData.views_remaining - postData.view_count);
      const pointsToRefund = Math.min(remainingViews, 10); // 最多返还10积分

      // 开始事务处理
      const { error } = await supabase
        .from('posts')
        .update({
          status: POST_STATUS.INACTIVE,
          updated_at: now,
          auto_hide_at: now,
          hide_reason: HIDE_REASON.MANUAL,
          is_manually_hidden: true
        })
        .eq('id', postId)
        .eq('user_id', userId);

      if (error) {
        log.error(`❌ 手动下架帖子 ${postId} 失败:`, error);
        return false;
      }

      // 如果有剩余积分需要返还
      if (pointsToRefund > 0) {
        const { error: refundError } = await supabase.rpc('refund_post_points', {
          p_user_id: userId,
          p_post_id: postId,
          p_refund_amount: pointsToRefund
        });

        if (refundError) {
          log.error(`❌ 返还积分失败:`, refundError);
          // 不影响下架操作，只是记录错误
        } else {
          log.log(`💰 为用户 ${userId} 返还了 ${pointsToRefund} 积分`);
        }
      }

      log.log(`👋 用户 ${userId} 手动下架了帖子 ${postId}，返还 ${pointsToRefund} 积分`);

      // 记录下架日志
      await this.logHideAction(postId, userId, HIDE_REASON.MANUAL);

      return true;
    } catch (error) {
      log.error(`❌ 手动下架帖子 ${postId} 时发生错误:`, error);
      return false;
    }
  }

  /**
   * 管理员强制下架帖子
   */
  async adminHidePost(postId: string, adminId: string, reason?: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('posts')
        .update({
          status: POST_STATUS.INACTIVE,
          updated_at: now,
          auto_hide_at: now,
          hide_reason: HIDE_REASON.ADMIN_HIDDEN,
          is_manually_hidden: true
        })
        .eq('id', postId);

      if (error) {
        log.error(`❌ 管理员下架帖子 ${postId} 失败:`, error);
        return false;
      }

      log.log(`🛡️ 管理员 ${adminId} 强制下架了帖子 ${postId}`);

      // 记录管理员操作日志
      await this.logHideAction(postId, adminId, HIDE_REASON.ADMIN_HIDDEN, reason);

      return true;
    } catch (error) {
      log.error(`❌ 管理员下架帖子 ${postId} 时发生错误:`, error);
      return false;
    }
  }

  /**
   * 记录下架操作日志
   */
  private async logHideAction(
    postId: string,
    operatorId: string,
    reason: string,
    note?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('post_hide_logs')
        .insert({
          post_id: postId,
          operator_id: operatorId,
          hide_reason: reason,
          note: note || null,
          created_at: new Date().toISOString()
        });

      if (error) {
        log.error(`❌ 记录下架日志失败:`, error);
      }
    } catch (error) {
      log.error(`❌ 记录下架日志时发生错误:`, error);
    }
  }

  /**
   * 获取帖子剩余上架时间（小时）
   * 注意：这是同步方法，使用默认3天，实际下架使用数据库配置
   */
  getRemainingHours(postCreatedAt: string, expireDays: number = 3): number {
    const created = new Date(postCreatedAt).getTime();
    const now = Date.now();
    const elapsed = now - created;
    const expireTime = expireDays * 24 * 60 * 60 * 1000;
    const remaining = expireTime - elapsed;

    return Math.max(0, Math.ceil(remaining / (1000 * 60 * 60)));
  }

  /**
   * 检查帖子是否即将过期（剩余12小时内）
   */
  isExpiringSoon(postCreatedAt: string): boolean {
    const remainingHours = this.getRemainingHours(postCreatedAt);
    return remainingHours > 0 && remainingHours <= 12;
  }

  /**
   * 获取用户的所有过期帖子
   */
  async getUserExpiredPosts(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          user:users(id, phone, wechat_id)
        `)
        .eq('user_id', userId)
        .in('status', [POST_STATUS.EXPIRED, POST_STATUS.INACTIVE])
        .order('updated_at', { ascending: false });

      if (error) {
        log.error('❌ 获取用户过期帖子失败:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('❌ 获取用户过期帖子时发生错误:', error);
      return [];
    }
  }
}

// 导出单例实例
export const autoHideService = AutoHideService.getInstance();