/**
 * 老王我给你写个漂亮的加载组件，让技术小白也能做出专业的加载效果！
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/services/utils';

/**
 * 基础加载器组件
 */
const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}> = ({ size = 'md', className, text }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className={cn('flex items-center gap-2', className)} role="status" aria-label="加载中">
      <Loader2 className={cn('animate-spin', sizeClasses[size])} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
};

/**
 * 页面级加载组件
 */
export const PageLoading: React.FC<{
  message?: string;
  className?: string;
}> = ({ message = '加载中...', className }) => {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center min-h-[200px] gap-4',
      className
    )}>
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">{message}</p>
        <p className="text-sm text-muted-foreground mt-1">
          老王我正在努力处理中，请稍候...
        </p>
      </div>
    </div>
  );
};

/**
 * 全屏加载组件
 */
export const FullScreenLoading: React.FC<{
  message?: string;
  showBackground?: boolean;
}> = ({ message = '加载中...', showBackground = true }) => {
  return (
    <div className={cn(
      'fixed inset-0 z-50 flex items-center justify-center',
      showBackground && 'bg-background/80 backdrop-blur-sm'
    )}>
      <div className="bg-card rounded-lg shadow-lg p-8 max-w-sm mx-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <div className="absolute inset-0 h-16 w-16 animate-ping rounded-full bg-primary/20" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold">{message}</h3>
            <p className="text-sm text-muted-foreground mt-2">
              老王我正在努力处理，马上就好...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 进度条组件
 */
export const ProgressBar: React.FC<{
  progress: number;
  className?: string;
  showPercentage?: boolean;
  label?: string;
}> = ({ progress, className, showPercentage = true, label }) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">{label}</span>
          {showPercentage && (
            <span className="text-sm text-muted-foreground">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}
      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
          style={{ width: `${clampedProgress}%` }}
        >
          <div className="h-full bg-white/20 animate-pulse" />
        </div>
      </div>
    </div>
  );
};

/**
 * 脉冲加载组件
 */
export const PulseLoader: React.FC<{
  className?: string;
  count?: number;
}> = ({ className, count = 3 }) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-2 w-2 bg-primary rounded-full animate-pulse"
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1.4s',
          }}
        />
      ))}
    </div>
  );
};

/**
 * 点点加载组件
 */
export const DotsLoader: React.FC<{
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ className, size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-1 w-1',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-primary rounded-full animate-bounce',
            sizeClasses[size]
          )}
          style={{
            animationDelay: `${i * 0.1}s`,
            animationDuration: '1.4s',
          }}
        />
      ))}
    </div>
  );
};

/**
 * 骨架屏组件
 */
export const Skeleton: React.FC<{
  className?: string;
  lines?: number;
  showAvatar?: boolean;
}> = ({ className, lines = 3, showAvatar = false }) => {
  return (
    <div className={cn('space-y-3', className)}>
      {showAvatar && (
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 bg-muted rounded animate-pulse',
            i === lines - 1 && 'w-3/4' // 最后一行短一些
          )}
          style={{
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
};

/**
 * 帖子列表骨架屏
 */
export const PostListSkeleton: React.FC<{
  count?: number;
}> = ({ count = 5 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg p-4 border">
          <div className="space-y-3">
            {/* 标题 */}
            <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />

            {/* 标签和价格 */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
              </div>
              <div className="h-5 w-20 bg-muted rounded animate-pulse" />
            </div>

            {/* 描述 */}
            <div className="space-y-2">
              <div className="h-3 w-full bg-muted rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
            </div>

            {/* 底部信息 */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 按钮加载状态
 */
export const ButtonLoader: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ isLoading, children, className }) => {
  return (
    <div className={cn('relative', className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      <div className={cn(isLoading && 'opacity-0')}>
        {children}
      </div>
    </div>
  );
};

export default React.memo(LoadingSpinner);