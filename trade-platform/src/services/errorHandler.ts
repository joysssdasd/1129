/**
 * 老王我给你写个全局错误处理器，让技术小白也能轻松管理所有错误！
 */

import { ERROR_CODES, ERROR_MESSAGES } from '@/constants';

/**
 * 自定义错误类
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string = ERROR_CODES.SERVER_ERROR,
    statusCode?: number,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;

    // 确保错误堆栈正确显示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * 网络错误类
 */
export class NetworkError extends AppError {
  constructor(message: string = ERROR_MESSAGES.NETWORK_ERROR, statusCode?: number) {
    super(message, ERROR_CODES.NETWORK_ERROR, statusCode);
    this.name = 'NetworkError';
  }
}

/**
 * API错误类
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, context);
    this.name = 'ApiError';
  }
}

/**
 * 验证错误类
 */
export class ValidationError extends AppError {
  constructor(message: string = '数据验证失败', field?: string) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400, { field });
    this.name = 'ValidationError';
  }
}

/**
 * 错误处理工具类
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorCallbacks: Array<(error: AppError) => void> = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 注册错误回调（用于错误上报、显示通知等）
   */
  onError(callback: (error: AppError) => void): () => void {
    this.errorCallbacks.push(callback);

    // 返回取消注册的函数
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 触发错误回调
   */
  private notifyError(error: AppError): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }

  /**
   * 处理未知错误，转换为AppError
   */
  handleError(error: unknown, defaultMessage?: string): AppError {
    let appError: AppError;

    if (error instanceof AppError) {
      // 已经是AppError，直接使用
      appError = error;
    } else if (error instanceof Error) {
      // 普通Error转换为AppError
      appError = new AppError(
        error.message || defaultMessage || ERROR_MESSAGES.SERVER_ERROR,
        ERROR_CODES.SERVER_ERROR,
        undefined,
        { originalError: error.name, stack: error.stack }
      );
    } else if (typeof error === 'string') {
      // 字符串错误转换为AppError
      appError = new AppError(error);
    } else {
      // 其他类型的错误
      appError = new AppError(
        defaultMessage || ERROR_MESSAGES.SERVER_ERROR,
        ERROR_CODES.SERVER_ERROR,
        undefined,
        { originalError: error }
      );
    }

    // 记录错误
    this.logError(appError);

    // 通知错误处理器
    this.notifyError(appError);

    return appError;
  }

  /**
   * 记录错误日志
   */
  private logError(error: AppError): void {
    if (import.meta.env.DEV) {
      console.group('🚨 App Error');
      console.error('Error:', error);
      console.error('Message:', error.message);
      console.error('Code:', error.code);
      console.error('Context:', error.context);
      console.groupEnd();
    } else {
      // 生产环境可以发送到错误监控服务
      // 例如: Sentry.captureException(error)
      console.error('App Error:', {
        name: error.name,
        message: error.message,
        code: error.code,
        context: error.context,
        stack: error.stack,
      });
    }
  }

  /**
   * 处理API响应错误
   */
  handleApiError(response: Response, data?: any): ApiError {
    const statusCode = response.status;
    const message = data?.message || response.statusText || ERROR_MESSAGES.SERVER_ERROR;
    const code = data?.code || this.getErrorCodeFromStatus(statusCode);

    const apiError = new ApiError(message, code, statusCode, {
      url: response.url,
      status: statusCode,
      response: data,
    });

    this.handleError(apiError);
    return apiError;
  }

  /**
   * 根据HTTP状态码获取错误代码
   */
  private getErrorCodeFromStatus(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return ERROR_CODES.VALIDATION_ERROR;
      case 401:
        return ERROR_CODES.UNAUTHORIZED;
      case 403:
        return ERROR_CODES.FORBIDDEN;
      case 404:
        return ERROR_CODES.POST_NOT_FOUND;
      case 429:
        return ERROR_CODES.NETWORK_ERROR; // 频率限制
      case 500:
      case 502:
      case 503:
      case 504:
        return ERROR_CODES.SERVER_ERROR;
      default:
        return ERROR_CODES.NETWORK_ERROR;
    }
  }

  /**
   * 处理网络错误
   */
  handleNetworkError(error: Error): NetworkError {
    let message: string = ERROR_MESSAGES.NETWORK_ERROR;
    let code: string = ERROR_CODES.NETWORK_ERROR;

    if (error.name === 'AbortError') {
      message = ERROR_MESSAGES.TIMEOUT_ERROR;
      code = ERROR_CODES.TIMEOUT_ERROR;
    } else if (error.message.includes('Failed to fetch')) {
      message = ERROR_MESSAGES.CONNECTION_ERROR;
      code = ERROR_CODES.NETWORK_ERROR;
    }

    const networkError = new NetworkError(message, 0);
    this.handleError(networkError);
    return networkError;
  }
}

/**
 * 全局错误处理器实例
 */
export const errorHandler = ErrorHandler.getInstance();

/**
 * 便捷的错误处理函数
 */
export const handleError = (error: unknown, defaultMessage?: string): AppError => {
  return errorHandler.handleError(error, defaultMessage);
};

/**
 * 异步错误处理装饰器
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler?: (error: AppError) => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = handleError(error);
      if (errorHandler) {
        errorHandler(appError);
      }
      throw appError;
    }
  }) as T;
}

/**
 * 创建特定类型的错误
 */
export const createError = {
  network: (message?: string) => new NetworkError(message),
  validation: (message: string, field?: string) => new ValidationError(message, field),
  api: (message: string, code: string, statusCode?: number, context?: any) =>
    new ApiError(message, code, statusCode, context),
  custom: (message: string, code: string, context?: any) =>
    new AppError(message, code, undefined, context),
};

/**
 * 错误类型判断工具
 */
export const isErrorType = {
  network: (error: any): error is NetworkError => error instanceof NetworkError,
  validation: (error: any): error is ValidationError => error instanceof ValidationError,
  api: (error: any): error is ApiError => error instanceof ApiError,
  app: (error: any): error is AppError => error instanceof AppError,
};