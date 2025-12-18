/**
 * 简单的内存缓存服务 - 提升数据加载速度
 */

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number // 过期时间（毫秒）
}

class CacheService {
  private cache = new Map<string, CacheItem<unknown>>()
  
  // 默认缓存时间：30秒
  private defaultTTL = 30 * 1000

  /**
   * 获取缓存数据
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key) as CacheItem<T> | undefined
    if (!item) return null
    
    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return item.data
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL
    })
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 清除匹配前缀的缓存
   */
  clearByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * 带缓存的数据获取
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // 先检查缓存
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }
    
    // 获取新数据
    const data = await fetcher()
    this.set(key, data, ttl)
    return data
  }
}

// 导出单例
export const cache = new CacheService()

// 缓存键常量
export const CACHE_KEYS = {
  POSTS: 'posts',
  POST_DETAIL: (id: string) => `post_${id}`,
  USER_POSTS: (userId: string) => `user_posts_${userId}`,
  ANNOUNCEMENTS: 'announcements',
  HOT_KEYWORDS: 'hot_keywords',
  SYSTEM_SETTINGS: 'system_settings',
}

// 缓存时间常量（毫秒）
export const CACHE_TTL = {
  SHORT: 10 * 1000,      // 10秒
  MEDIUM: 30 * 1000,     // 30秒
  LONG: 60 * 1000,       // 1分钟
  VERY_LONG: 5 * 60 * 1000, // 5分钟
}
