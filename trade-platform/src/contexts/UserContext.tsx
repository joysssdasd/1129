/**
 * 老王我给你重构了用户状态管理，用Zustand让技术小白也能轻松管理用户状态！
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { User } from '@/types';
import { STORAGE_KEYS } from '@/constants';
import { toast } from '@/services/toastService';
import { log } from '@/utils/logger';

/**
 * 用户状态接口
 */
interface UserState {
  // 状态
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // 动作
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  updatePoints: (points: number, change: number) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  refreshToken: () => Promise<void>;

  // 权限检查
  hasPermission: (permission: string) => boolean;
  canViewPost: (postId: string) => boolean;
  hasEnoughPoints: (required: number) => boolean;
}

/**
 * 用户状态管理
 */
export const useUserStore = create<UserState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // 初始状态
        user: null,
        isAuthenticated: false,
        isLoading: false,

        // 设置用户
        setUser: (user) => {
          set({
            user,
            isAuthenticated: !!user,
          });
        },

        // 更新用户信息
        updateUser: (updates) => {
          const { user } = get();
          if (user) {
            const updatedUser = { ...user, ...updates };
            set({ user: updatedUser });
          }
        },

        // 更新积分
        updatePoints: (newPoints, change) => {
          const { user } = get();
          if (user) {
            const updatedUser = { ...user, points: newPoints };
            set({ user: updatedUser });

            // 显示积分变化提示
            if (change > 0) {
              toast.success(`积分 +${change}`, '积分增加');
            } else if (change < 0) {
              toast.warning(`积分 ${change}`, '积分消耗');
            }
          }
        },

        // 设置加载状态
        setLoading: (loading) => {
          set({ isLoading: loading });
        },

        // 登出
        logout: () => {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          toast.info('您已安全退出', '退出成功');
        },

        // 刷新token（实际项目中应该调用API）
        refreshToken: async () => {
          const { setLoading } = get();
          try {
            setLoading(true);
            // TODO: 调用刷新token的API
            // await authService.refreshToken();
          } catch (error) {
            log.error('刷新token失败:', error);
            toast.error('登录已过期，请重新登录');
            get().logout();
          } finally {
            setLoading(false);
          }
        },

        // 权限检查
        hasPermission: (permission) => {
          const { user } = get();
          if (!user) return false;

          switch (permission) {
            case 'admin':
              return user.is_admin;
            case 'user':
              return true;
            default:
              return false;
          }
        },

        // 检查是否可以查看帖子
        canViewPost: (postId) => {
          const { user } = get();
          if (!user) return false;

          // TODO: 检查用户是否已经查看过此帖子
          // const hasViewed = await checkIfUserViewedPost(user.id, postId);
          // return !hasViewed && user.points >= 1;

          return user.points >= 1;
        },

        // 检查积分是否足够
        hasEnoughPoints: (required) => {
          const { user } = get();
          if (!user) return false;
          return user.points >= required;
        },
      }),
      {
        name: STORAGE_KEYS.USER_INFO,
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
        onRehydrateStorage: () => (state) => {
          // 恢复状态时的回调
          if (state) {
            log.log('用户状态已从本地存储恢复');
          }
        },
      }
    )
  )
);

/**
 * 用户状态Hook，提供更便捷的API
 */
export const useUser = () => {
  const userStore = useUserStore();

  return {
    // 基础状态
    ...userStore,

    // 便捷的状态获取
    user: userStore.user,
    isAdmin: userStore.user?.is_admin || false,
    userName: userStore.user?.phone || '',
    userPoints: userStore.user?.points || 0,
    userInviteCode: userStore.user?.invite_code || '',

    // 便捷的方法
    isLoggedIn: userStore.isAuthenticated,
    needsWechat: !userStore.user?.wechat_id,

    // 快速操作
    addPoints: (amount: number, reason?: string) => {
      const currentPoints = userStore.user?.points || 0;
      userStore.updatePoints(currentPoints + amount, amount);
      if (reason) {
        toast.success(reason, '积分奖励');
      }
    },

    deductPoints: (amount: number, reason?: string) => {
      const currentPoints = userStore.user?.points || 0;
      if (currentPoints >= amount) {
        userStore.updatePoints(currentPoints - amount, -amount);
        if (reason) {
          toast.info(reason, '积分消耗');
        }
        return true;
      } else {
        toast.error('积分不足', '操作失败');
        return false;
      }
    },
  };
};

/**
 * 权限检查Hook
 */
export const usePermissions = () => {
  const { hasPermission, user } = useUser();

  return {
    isAdmin: hasPermission('admin'),
    isUser: hasPermission('user'),
    can: (permission: string) => hasPermission(permission),
    hasRole: (role: string) => user?.role === role,
  };
};

/**
 * 积分管理Hook
 */
export const usePoints = () => {
  const { user, hasEnoughPoints, updatePoints } = useUser();

  return {
    currentPoints: user?.points || 0,
    hasEnoughPoints: (amount: number) => hasEnoughPoints(amount),
    canPublish: hasEnoughPoints(10), // 发布帖子需要10积分
    canViewContact: hasEnoughPoints(1), // 查看联系方式需要1积分
    updatePoints: updatePoints,
  };
};

// 兼容性：保留原来的Context API（用于迁移）
import React, { createContext, useContext } from 'react';

interface LegacyUserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const LegacyUserContext = createContext<LegacyUserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser, logout } = useUser();

  return (
    <LegacyUserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </LegacyUserContext.Provider>
  );
}

/**
 * @deprecated 使用 useUser() Hook 替代
 */
export function useLegacyUser() {
  const context = useContext(LegacyUserContext);
  if (context === undefined) {
    throw new Error('useLegacyUser must be used within a UserProvider');
  }
  return context;
}

// 导出状态类型供其他组件使用
export type { UserState };
