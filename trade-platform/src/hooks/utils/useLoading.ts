/**
 * 老王我给你写个超级好用的加载状态Hook，让技术小白也能轻松管理加载状态！
 */

import { useState, useCallback, useRef } from 'react';

/**
 * 加载状态接口
 */
interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

/**
 * 加载操作接口
 */
interface LoadingActions {
  setLoading: (loading: boolean, message?: string) => void;
  setProgress: (progress: number) => void;
  execute: <T>(fn: () => Promise<T>, message?: string) => Promise<T>;
  executeWithProgress: <T>(
    fn: (setProgress: (progress: number) => void) => Promise<T>,
    message: string
  ) => Promise<T>;
}

/**
 * 通用加载状态Hook
 */
export const useLoading = (initialMessage?: string): LoadingState & LoadingActions => {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    message: initialMessage,
    progress: undefined,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 设置加载状态
   */
  const setLoading = useCallback((loading: boolean, message?: string) => {
    setState(prev => ({
      ...prev,
      isLoading: loading,
      message: loading ? (message || prev.message) : undefined,
      progress: loading ? prev.progress : undefined,
    }));

    // 如果开始加载，创建新的AbortController
    if (loading) {
      abortControllerRef.current = new AbortController();
    } else {
      // 如果结束加载，取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, []);

  /**
   * 设置进度
   */
  const setProgress = useCallback((progress: number) => {
    setState(prev => ({
      ...prev,
      progress: Math.max(0, Math.min(100, progress)),
    }));
  }, []);

  /**
   * 执行异步操作
   */
  const execute = useCallback(async <T>(
    fn: () => Promise<T>,
    message?: string
  ): Promise<T> => {
    try {
      setLoading(true, message);
      const result = await fn();
      return result;
    } catch (error) {
      console.error('异步操作执行失败:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  /**
   * 执行带进度的异步操作
   */
  const executeWithProgress = useCallback(async <T>(
    fn: (setProgress: (progress: number) => void) => Promise<T>,
    message: string
  ): Promise<T> => {
    try {
      setLoading(true, message);
      const result = await fn(setProgress);
      return result;
    } catch (error) {
      console.error('异步操作执行失败:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  return {
    ...state,
    setLoading,
    setProgress,
    execute,
    executeWithProgress,
  };
};

/**
 * 模拟进度的Hook（用于文件上传等场景）
 */
export const useSimulatedProgress = () => {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startProgress = useCallback(() => {
    setProgress(0);

    // 模拟进度增长
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          // 达到95%时停止，等待实际完成
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return prev;
        }
        return prev + Math.random() * 15; // 随机增长
      });
    }, 300);
  }, []);

  const completeProgress = useCallback(() => {
    // 清除定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 设置为100%
    setProgress(100);

    // 短暂延迟后重置
    setTimeout(() => {
      setProgress(0);
    }, 500);
  }, []);

  const resetProgress = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
  }, []);

  // 清理定时器
  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return {
    progress,
    startProgress,
    completeProgress,
    resetProgress,
    clear,
  };
};

/**
 * 防抖加载Hook
 */
export const useDebouncedLoading = (delay: number = 300) => {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setLoading = useCallback((loading: boolean, message?: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (loading) {
      // 延迟显示加载状态
      timeoutRef.current = setTimeout(() => {
        setState({ isLoading: true, message });
      }, delay);
    } else {
      // 立即隐藏加载状态
      setState({ isLoading: false });
    }
  }, [delay]);

  return {
    ...state,
    setLoading,
  };
};

/**
 * 重试操作Hook
 */
export const useRetry = <T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: boolean;
  } = {}
) => {
  const { maxRetries = 3, delay = 1000, backoff = true } = options;
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const executeWithRetry = useCallback(async (...args: Args): Promise<T> => {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setRetryCount(attempt);
          setIsRetrying(true);

          // 计算延迟时间
          const retryDelay = backoff ? delay * Math.pow(2, attempt - 1) : delay;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        const result = await fn(...args);

        // 成功时重置状态
        setRetryCount(0);
        setIsRetrying(false);

        return result;
      } catch (error) {
        lastError = error as Error;

        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          setIsRetrying(false);
          throw lastError;
        }

        console.warn(`第 ${attempt + 1} 次尝试失败:`, lastError.message);
      }
    }

    throw lastError!;
  }, [fn, maxRetries, delay, backoff]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    executeWithRetry,
    retryCount,
    isRetrying,
    canRetry: retryCount < maxRetries,
    reset,
  };
};

export default useLoading;