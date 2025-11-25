/**
 * 老王我给你写个Toast显示组件，让技术小白也能看到漂亮的提示！
 */

import React from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useToast, Toast } from '@/services/toastService';
import { cn } from '@/services/utils';

/**
 * 单个Toast组件
 */
const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({
  toast,
  onRemove,
}) => {
  // 根据类型获取图标和样式
  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: CheckCircle,
          className: 'bg-green-50 border-green-200 text-green-800',
          iconClassName: 'text-green-500',
        };
      case 'error':
        return {
          icon: XCircle,
          className: 'bg-red-50 border-red-200 text-red-800',
          iconClassName: 'text-red-500',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          className: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          iconClassName: 'text-yellow-500',
        };
      case 'info':
      default:
        return {
          icon: Info,
          className: 'bg-blue-50 border-blue-200 text-blue-800',
          iconClassName: 'text-blue-500',
        };
    }
  };

  const { icon: Icon, className, iconClassName } = getToastStyles();

  return (
    <div
      className={cn(
        'relative max-w-sm w-full p-4 rounded-lg border shadow-lg pointer-events-auto',
        'transform transition-all duration-300 ease-in-out',
        'animate-in slide-in-from-right-5 fade-in-0',
        className
      )}
    >
      {/* 关闭按钮 */}
      <button
        onClick={() => onRemove(toast.id)}
        className="absolute right-2 top-2 p-1 rounded-md hover:bg-black/10 transition-colors"
        aria-label="关闭通知"
      >
        <X className="h-4 w-4 opacity-70 hover:opacity-100" />
      </button>

      <div className="flex items-start space-x-3">
        {/* 图标 */}
        <div className="flex-shrink-0">
          <Icon className={cn('h-5 w-5', iconClassName)} />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <h4 className="text-sm font-medium mb-1">{toast.title}</h4>
          )}
          <p className="text-sm opacity-90 break-words">{toast.message}</p>

          {/* 操作按钮 */}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium underline hover:no-underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      </div>

      {/* 进度条（如果不是持久化的Toast） */}
      {!toast.persistent && toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 h-1 bg-current opacity-20 rounded-b-lg animate-out">
          <div
            className="h-full bg-current opacity-40 rounded-b-lg"
            style={{
              animation: `shrink-linear ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Toast容器组件
 */
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

/**
 * Toast提供者组件
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
};

/**
 * 简化版Toast Hook
 */
export const useToastMessage = () => {
  const { addToast, removeToast, clearAllToasts } = useToast();

  return {
    success: (message: string, title?: string, options?: any) =>
      addToast({ type: 'success', message, title, ...options }),
    error: (message: string, title?: string, options?: any) =>
      addToast({ type: 'error', message, title, duration: 6000, ...options }),
    warning: (message: string, title?: string, options?: any) =>
      addToast({ type: 'warning', message, title, ...options }),
    info: (message: string, title?: string, options?: any) =>
      addToast({ type: 'info', message, title, ...options }),
    loading: (message: string, title?: string) =>
      addToast({ type: 'info', message, title, persistent: true }),

    remove: removeToast,
    clear: clearAllToasts,

    // 便捷方法
    showSuccess: (message: string, title?: string) =>
      addToast({ type: 'success', message, title }),
    showError: (message: string, title?: string) =>
      addToast({ type: 'error', message, title }),
    showWarning: (message: string, title?: string) =>
      addToast({ type: 'warning', message, title }),
    showInfo: (message: string, title?: string) =>
      addToast({ type: 'info', message, title }),
  };
};

export default ToastProvider;