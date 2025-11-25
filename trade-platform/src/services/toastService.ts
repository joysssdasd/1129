/**
 * 老王我给你写个Toast通知服务，让技术小白也能轻松显示各种提示！
 */

import { create } from 'zustand';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/constants';

/**
 * Toast消息类型
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast消息接口
 */
export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean; // 是否持久显示（需要手动关闭）
}

/**
 * Toast状态管理
 */
interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
}

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toastData) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: Toast = {
      id,
      duration: 4000, // 默认4秒
      ...toastData,
    };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // 如果不是持久化的Toast，自动移除
    if (!toast.persistent && toast.duration && toast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, toast.duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  clearAllToasts: () => {
    set({ toasts: [] });
  },
}));

/**
 * Toast服务类，提供便捷的方法
 */
export class ToastService {
  /**
   * 显示成功消息
   */
  success(message: string, title?: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message' | 'title'>>) {
    const { addToast } = useToast.getState();
    return addToast({
      type: 'success',
      title,
      message,
      ...options,
    });
  }

  /**
   * 显示错误消息
   */
  error(message: string, title?: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message' | 'title'>>) {
    const { addToast } = useToast.getState();
    return addToast({
      type: 'error',
      title,
      message,
      duration: 6000, // 错误消息显示更长时间
      ...options,
    });
  }

  /**
   * 显示警告消息
   */
  warning(message: string, title?: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message' | 'title'>>) {
    const { addToast } = useToast.getState();
    return addToast({
      type: 'warning',
      title,
      message,
      ...options,
    });
  }

  /**
   * 显示信息消息
   */
  info(message: string, title?: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message' | 'title'>>) {
    const { addToast } = useToast.getState();
    return addToast({
      type: 'info',
      title,
      message,
      ...options,
    });
  }

  /**
   * 显示持久化消息（需要手动关闭）
   */
  persistent(message: string, type: ToastType = 'info', title?: string) {
    const { addToast } = useToast.getState();
    return addToast({
      type,
      title,
      message,
      persistent: true,
      duration: 0, // 不自动消失
    });
  }

  /**
   * 显示带操作按钮的消息
   */
  withAction(
    message: string,
    actionLabel: string,
    actionCallback: () => void,
    type: ToastType = 'info',
    title?: string
  ) {
    const { addToast } = useToast.getState();
    return addToast({
      type,
      title,
      message,
      action: {
        label: actionLabel,
        onClick: actionCallback,
      },
      persistent: true,
    });
  }

  /**
   * 移除指定的Toast
   */
  remove(id: string) {
    useToast.getState().removeToast(id);
  }

  /**
   * 清除所有Toast
   */
  clear() {
    useToast.getState().clearAllToasts();
  }

  /**
   * 显示预定义的成功消息
   */
  showSuccessMessage(key: keyof typeof SUCCESS_MESSAGES, title?: string) {
    return this.success(SUCCESS_MESSAGES[key], title);
  }

  /**
   * 显示预定义的错误消息
   */
  showErrorMessage(key: keyof typeof ERROR_MESSAGES, title?: string) {
    return this.error(ERROR_MESSAGES[key], title);
  }
}

/**
 * 全局Toast服务实例
 */
export const toast = new ToastService();

/**
 * 便捷的Hook，提供更简洁的API
 */
export const useToastMessage = () => {
  const { addToast, removeToast, clearAllToasts } = useToast();

  return {
    success: (message: string, title?: string) => addToast({ type: 'success', message, title }),
    error: (message: string, title?: string) => addToast({ type: 'error', message, title }),
    warning: (message: string, title?: string) => addToast({ type: 'warning', message, title }),
    info: (message: string, title?: string) => addToast({ type: 'info', message, title }),
    loading: (message: string, title?: string) =>
      addToast({ type: 'info', message, title, persistent: true }),

    remove: removeToast,
    clear: clearAllToasts,

    // 便捷方法
    showSuccess: (key: keyof typeof SUCCESS_MESSAGES, title?: string) =>
      addToast({ type: 'success', message: SUCCESS_MESSAGES[key], title }),
    showError: (key: keyof typeof ERROR_MESSAGES, title?: string) =>
      addToast({ type: 'error', message: ERROR_MESSAGES[key], title }),
  };
};

/**
 * React Error Boundary错误处理
 */
export const handleBoundaryError = (error: Error, errorInfo: React.ErrorInfo) => {
  toast.error(
    `应用程序遇到错误: ${error.message}`,
    '系统错误',
    {
      persistent: true,
      action: {
        label: '查看详情',
        onClick: () => {
          console.group('Error Boundary Details');
          console.error('Error:', error);
          console.error('Error Info:', errorInfo);
          console.groupEnd();
        },
      },
    }
  );
};