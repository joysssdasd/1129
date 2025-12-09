import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { log } from '../../utils/logger';

/**
 * 老王我给你写个更好的错误边界组件，让技术小白也能看懂哪里出错了！
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void; goHome: () => void }>;
  maxRetries?: number;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // 调用错误回调（可以用来发送错误报告）
    this.props.onError?.(error, errorInfo);

    // 开发环境打印详细错误信息
    if (import.meta.env.DEV) {
      console.group('🚨 Error Boundary Caught an Error');
      log.error('Error:', error);
      log.error('Error Info:', errorInfo);
      console.groupEnd();
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;

    if (this.state.retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  handleGoHome = () => {
    // 清除错误状态并回到首页
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
    window.location.href = '/';
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // 如果提供了自定义的错误组件，使用自定义组件
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            retry={this.handleRetry}
            goHome={this.handleGoHome}
          />
        );
      }

      // 默认错误界面
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            {/* 错误图标 */}
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>

            {/* 错误标题 */}
            <h1 className="text-xl font-semibold text-gray-900 text-center mb-2">
              哎呀，出错了！
            </h1>

            {/* 错误描述 */}
            <p className="text-gray-600 text-center mb-6">
              老王我遇到了一个技术问题，别担心，这不是你的错。
            </p>

            {/* 开发环境显示详细错误 */}
            {import.meta.env.DEV && (
              <Alert className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="mt-2">
                    <p className="font-mono text-sm break-all">
                      {this.state.error.message}
                    </p>
                    {this.state.errorInfo && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-medium">
                          查看详细错误信息
                        </summary>
                        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={this.handleRetry}
                disabled={this.state.retryCount >= (this.props.maxRetries || 3)}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重试 {this.state.retryCount > 0 && `(${this.state.retryCount}/${this.props.maxRetries || 3})`}
              </Button>

              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="flex-1"
              >
                <Home className="w-4 h-4 mr-2" />
                回到首页
              </Button>
            </div>

            {/* 帮助信息 */}
            <div className="mt-6 text-center text-sm text-gray-500">
              <p>如果问题持续存在，请联系技术支持</p>
              <p className="mt-1">
                错误ID: {this.state.error.name || 'Unknown'}-{Date.now().toString(36)}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 简化版错误边界，用于特定的组件
 */
export function SimpleErrorBoundary({
  children,
  fallback
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={() => fallback || <div className="p-4 text-red-500">组件加载失败</div>}
      maxRetries={1}
    >
      {children}
    </ErrorBoundary>
  );
}