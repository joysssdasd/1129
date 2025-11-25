/**
 * 老王我给你写个安全增强的Hook，让技术小白也能轻松处理安全问题！
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { STORAGE_KEYS, TIME } from '@/constants';

/**
 * 频率限制接口
 */
interface RateLimitState {
  count: number;
  lastAttempt: number;
  isBlocked: boolean;
  remainingTime: number;
}

/**
 * 频率限制Hook
 */
export const useRateLimit = (maxAttempts: number = 5, timeWindow: number = 60000) => {
  const [state, setState] = useState<RateLimitState>({
    count: 0,
    lastAttempt: 0,
    isBlocked: false,
    remainingTime: 0,
  });

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastAttempt = now - state.lastAttempt;

    // 如果时间窗口已过，重置计数
    if (timeSinceLastAttempt > timeWindow) {
      setState({
        count: 1,
        lastAttempt: now,
        isBlocked: false,
        remainingTime: 0,
      });
      return true;
    }

    // 如果达到最大尝试次数，阻止操作
    if (state.count >= maxAttempts) {
      const remainingTime = timeWindow - timeSinceLastAttempt;
      setState(prev => ({
        ...prev,
        isBlocked: true,
        remainingTime,
      }));
      return false;
    }

    // 增加计数
    setState(prev => ({
      ...prev,
      count: prev.count + 1,
      lastAttempt: now,
    }));

    return true;
  }, [maxAttempts, timeWindow, state.count, state.lastAttempt]);

  // 更新剩余时间
  useEffect(() => {
    if (state.isBlocked && state.remainingTime > 0) {
      const timer = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isBlocked: false,
          count: 0,
          remainingTime: 0,
        }));
      }, state.remainingTime);

      return () => clearTimeout(timer);
    }
  }, [state.isBlocked, state.remainingTime]);

  const reset = useCallback(() => {
    setState({
      count: 0,
      lastAttempt: 0,
      isBlocked: false,
      remainingTime: 0,
    });
  }, []);

  return {
    ...state,
    checkRateLimit,
    reset,
  };
};

/**
 * 防抖Hook
 */
export const useDebounce = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

/**
 * 安全存储Hook
 */
export const useSecureStorage = () => {
  /**
   * 安全地设置存储项
   */
  const setItem = useCallback((key: string, value: any, encrypt: boolean = false): void => {
    try {
      const dataToStore = encrypt
        ? btoa(JSON.stringify(value)) // 简单的base64编码（生产环境应使用更安全的加密）
        : JSON.stringify(value);

      localStorage.setItem(key, dataToStore);
    } catch (error) {
      console.error('存储数据失败:', error);
    }
  }, []);

  /**
   * 安全地获取存储项
   */
  const getItem = useCallback(<T = any>(key: string, decrypt: boolean = false): T | null => {
    try {
      const storedData = localStorage.getItem(key);
      if (!storedData) return null;

      const data = decrypt
        ? JSON.parse(atob(storedData))
        : JSON.parse(storedData);

      return data;
    } catch (error) {
      console.error('读取数据失败:', error);
      return null;
    }
  }, []);

  /**
   * 安全地删除存储项
   */
  const removeItem = useCallback((key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('删除数据失败:', error);
    }
  }, []);

  /**
   * 清除所有应用数据
   */
  const clearAppData = useCallback((): void => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('清除数据失败:', error);
    }
  }, []);

  return {
    setItem,
    getItem,
    removeItem,
    clearAppData,
  };
};

/**
 * 会话管理Hook
 */
export const useSession = () => {
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const { getItem, setItem, removeItem } = useSecureStorage();

  // 会话超时时间（30分钟）
  const SESSION_TIMEOUT = 30 * 60 * 1000;

  /**
   * 更新活动时间
   */
  const updateActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    setItem(STORAGE_KEYS.LAST_ACTIVITY, now);
  }, [setItem]);

  /**
   * 检查会话是否过期
   */
  const checkSessionExpired = useCallback((): boolean => {
    const storedActivity = getItem<number>(STORAGE_KEYS.LAST_ACTIVITY);
    const lastActiveTime = storedActivity || lastActivity;
    const now = Date.now();

    const expired = (now - lastActiveTime) > SESSION_TIMEOUT;

    if (expired !== isSessionExpired) {
      setIsSessionExpired(expired);
    }

    return expired;
  }, [getItem, lastActivity, isSessionExpired]);

  /**
   * 延长会话
   */
  const extendSession = useCallback(() => {
    updateActivity();
    setIsSessionExpired(false);
  }, [updateActivity]);

  /**
   * 结束会话
   */
  const endSession = useCallback(() => {
    removeItem(STORAGE_KEYS.AUTH_TOKEN);
    removeItem(STORAGE_KEYS.USER_INFO);
    removeItem(STORAGE_KEYS.LAST_ACTIVITY);
    setIsSessionExpired(true);
  }, [removeItem]);

  // 定期检查会话状态
  useEffect(() => {
    const interval = setInterval(() => {
      if (checkSessionExpired()) {
        console.log('会话已过期');
      }
    }, 60000); // 每分钟检查一次

    return () => clearInterval(interval);
  }, [checkSessionExpired]);

  // 监听用户活动
  useEffect(() => {
    const handleActivity = () => {
      updateActivity();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [updateActivity]);

  return {
    lastActivity,
    isSessionExpired,
    updateActivity,
    checkSessionExpired,
    extendSession,
    endSession,
  };
};

/**
 * 输入清理Hook
 */
export const useInputSanitization = () => {
  /**
   * 清理字符串输入
   */
  const sanitizeString = useCallback((input: string): string => {
    if (typeof input !== 'string') return '';

    return input
      .trim() // 移除首尾空白
      .replace(/[<>]/g, '') // 移除潜在的HTML标签
      .replace(/javascript:/gi, '') // 移除javascript协议
      .replace(/on\w+=/gi, '') // 移除事件处理器
      .substring(0, 1000); // 限制长度
  }, []);

  /**
   * 清理数字输入
   */
  const sanitizeNumber = useCallback((input: any): number => {
    const num = Number(input);
    return isNaN(num) ? 0 : Math.max(0, Math.min(999999999, num));
  }, []);

  /**
   * 清理手机号
   */
  const sanitizePhone = useCallback((input: string): string => {
    const cleaned = input.replace(/\D/g, ''); // 只保留数字
    return cleaned.startsWith('1') ? cleaned.substring(0, 11) : '';
  }, []);

  /**
   * 验证URL
   */
  const isValidUrl = useCallback((url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }, []);

  return {
    sanitizeString,
    sanitizeNumber,
    sanitizePhone,
    isValidUrl,
  };
};

/**
 * CSRF保护Hook
 */
export const useCSRFProtection = () => {
  const [csrfToken, setCsrfToken] = useState<string>('');
  const { getItem, setItem } = useSecureStorage();

  /**
   * 生成CSRF令牌
   */
  const generateToken = useCallback((): string => {
    const token = btoa(Math.random().toString(36) + Date.now().toString());
    setCsrfToken(token);
    setItem('csrf_token', token);
    return token;
  }, [setItem]);

  /**
   * 验证CSRF令牌
   */
  const validateToken = useCallback((token: string): boolean => {
    const storedToken = getItem('csrf_token');
    return storedToken === token && token.length > 0;
  }, [getItem]);

  /**
   * 刷新令牌
   */
  const refreshToken = useCallback((): string => {
    return generateToken();
  }, [generateToken]);

  // 初始化时生成令牌
  useEffect(() => {
    const storedToken = getItem('csrf_token');
    if (storedToken) {
      setCsrfToken(storedToken);
    } else {
      generateToken();
    }
  }, [getItem, generateToken]);

  return {
    csrfToken,
    generateToken,
    validateToken,
    refreshToken,
  };
};

/**
 * 环境检查Hook
 */
export const useEnvironment = () => {
  const [isDev, setIsDev] = useState(import.meta.env.DEV);
  const [isProd, setIsProd] = useState(import.meta.env.PROD);
  const [environment, setEnvironment] = useState<string>(import.meta.env.MODE);

  /**
   * 检查是否为移动设备
   */
  const [isMobile, setIsMobile] = useState(false);

  /**
   * 检查网络状态
   */
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      setIsMobile(mobileRegex.test(userAgent) || window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 监听网络状态
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isDev,
    isProd,
    environment,
    isMobile,
    isOnline,
    userAgent: navigator.userAgent,
  };
};

export default {
  useRateLimit,
  useDebounce,
  useSecureStorage,
  useSession,
  useInputSanitization,
  useCSRFProtection,
  useEnvironment,
};