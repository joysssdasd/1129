import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { supabase } from '../../services/supabase'
import { Home, PlusCircle, User, Search, LogOut, RefreshCw, TrendingUp, X, Megaphone } from 'lucide-react'
import { log } from '../../utils/logger'
import { searchAndSort, extractKeywordStats, getSearchSuggestions } from '../../utils/searchUtils'
import { cache, CACHE_KEYS, CACHE_TTL } from '../../services/cacheService'
import CategoryCards from '../CategoryCards'

interface Post {
  id: string
  title: string
  price: number
  trade_type: number
  view_count: number
  view_limit: number
  created_at: string
  user_id: string
  keywords: string
  delivery_days?: number
}

const tradeTypeMap: { [key: number]: { label: string; color: string } } = {
  1: { label: '求购', color: 'bg-green-100 text-green-700' },
  2: { label: '出售', color: 'bg-blue-100 text-blue-700' },
  3: { label: '做多', color: 'bg-red-100 text-red-700' },
  4: { label: '做空', color: 'bg-purple-100 text-purple-700' }
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedType, setSelectedType] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [hotKeywords, setHotKeywords] = useState<{ keyword: string; count: number }[]>([])
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; content: string }[]>([])
  const [closedAnnouncements, setClosedAnnouncements] = useState<string[]>([])
  const { user, setUser, logout } = useUser()
  const navigate = useNavigate()
  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadPosts()
  }, [selectedType])

  // 初次加载时并行获取数据（提升加载速度）
  useEffect(() => {
    // 并行加载所有数据
    Promise.all([
      loadAllPosts(),
      loadAnnouncements()
    ])
    // 加载已关闭的公告列表
    const closed = localStorage.getItem('closedAnnouncements')
    if (closed) {
      setClosedAnnouncements(JSON.parse(closed))
    }
  }, [])

  // 加载公告（带缓存）
  const loadAnnouncements = async () => {
    const data = await cache.getOrFetch(
      CACHE_KEYS.ANNOUNCEMENTS,
      async () => {
        const { data } = await supabase
          .from('announcements')
          .select('id, title, content')
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .limit(3)
        return data || []
      },
      CACHE_TTL.LONG // 1分钟缓存
    )
    setAnnouncements(data)
  }

  // 关闭公告
  const handleCloseAnnouncement = (announcementId: string) => {
    const newClosed = [...closedAnnouncements, announcementId]
    setClosedAnnouncements(newClosed)
    localStorage.setItem('closedAnnouncements', JSON.stringify(newClosed))
  }

  // 过滤已关闭的公告
  const visibleAnnouncements = announcements.filter(ann => !closedAnnouncements.includes(ann.id))

  // 从所有帖子中提取所有关键词用于搜索建议
  const allKeywords = useMemo(() => {
    const keywordSet = new Set<string>()
    allPosts.forEach(post => {
      if (post.keywords) {
        post.keywords.split(',').forEach(k => {
          const trimmed = k.trim()
          if (trimmed) keywordSet.add(trimmed)
        })
      }
      // 也将标题加入搜索建议
      if (post.title) keywordSet.add(post.title)
    })
    return Array.from(keywordSet)
  }, [allPosts])

  // 获取搜索建议
  const suggestions = useMemo(() => {
    if (!searchKeyword.trim() || searchKeyword.length < 1) return []
    return getSearchSuggestions(searchKeyword, allKeywords, 8)
  }, [searchKeyword, allKeywords])

  // 加载所有帖子（带缓存）
  const loadAllPosts = async () => {
    try {
      const data = await cache.getOrFetch(
        CACHE_KEYS.POSTS,
        async () => {
          const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('status', 1)
            .order('created_at', { ascending: false })
            .limit(200)
          if (error) throw error
          return data || []
        },
        CACHE_TTL.SHORT // 10秒缓存
      )
      
      setAllPosts(data)
      
      // 提取热门关键词（带缓存）
      const stats = cache.get<{ keyword: string; count: number }[]>(CACHE_KEYS.HOT_KEYWORDS) 
        || extractKeywordStats(data)
      cache.set(CACHE_KEYS.HOT_KEYWORDS, stats, CACHE_TTL.MEDIUM)
      setHotKeywords(stats.slice(0, 10))
    } catch (error) {
      log.error('加载全部帖子失败:', error)
    }
  }

  const loadPosts = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('posts')
        .select('*')
        .eq('status', 1)
        .order('created_at', { ascending: false })
        .limit(50)

      if (selectedType) {
        query = query.eq('trade_type', selectedType)
      }

      const { data, error } = await query

      if (error) throw error
      setPosts(data || [])
    } catch (error) {
      log.error('加载失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 执行搜索（支持模糊搜索和拼音首字母）
  const handleSearch = useCallback(async (keyword?: string) => {
    const searchTerm = keyword ?? searchKeyword
    setShowSuggestions(false)
    
    if (!searchTerm.trim()) {
      loadPosts()
      return
    }

    setLoading(true)
    try {
      // 先从数据库获取所有数据
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 1)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error

      // 使用本地模糊搜索和排序
      const filtered = searchAndSort(
        data || [],
        searchTerm,
        (post) => [post.title, post.keywords || '']
      )

      setPosts(filtered.slice(0, 50))
    } catch (error) {
      log.error('搜索失败:', error)
    } finally {
      setLoading(false)
    }
  }, [searchKeyword])

  // 点击热门关键词搜索
  const handleHotKeywordClick = (keyword: string) => {
    setSearchKeyword(keyword)
    handleSearch(keyword)
  }

  // 选择搜索建议
  const handleSuggestionClick = (suggestion: string) => {
    setSearchKeyword(suggestion)
    setShowSuggestions(false)
    handleSearch(suggestion)
  }

  // 清除搜索
  const handleClearSearch = () => {
    setSearchKeyword('')
    setShowSuggestions(false)
    loadPosts()
  }

  // 点击外部关闭建议
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleQuickTrade = async (post: Post, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!user) {
      alert('请先登录')
      return
    }

    if (user.points < 1) {
      alert('积分不足，请先充值')
      navigate('/profile')
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('view-contact', {
        body: {
          user_id: user.id,
          post_id: post.id
        }
      })

      if (error) throw error

      if (data?.data?.wechat_id) {
        navigator.clipboard.writeText(data.data.wechat_id)
        alert(`交易方式已复制到剪贴板：${data.data.wechat_id}`)
        
        // 更新用户积分
        if (!data.data.already_viewed && user) {
          const { data: updatedUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (updatedUser) setUser(updatedUser)
        }
      }
    } catch (error: any) {
      alert(error.message || '操作失败')
    }
  }

  // 下拉刷新功能
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (refreshing || loading) return
    
    const currentY = e.touches[0].clientY
    const distance = currentY - touchStartY.current
    
    if (distance > 0 && containerRef.current && containerRef.current.scrollTop === 0) {
      setPullDistance(Math.min(distance, 100))
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance > 60 && !refreshing) {
      setRefreshing(true)
      await loadPosts()
      
      // 同时刷新用户信息
      if (user) {
        const { data: updatedUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (updatedUser) setUser(updatedUser)
      }
      
      setRefreshing(false)
    }
    setPullDistance(0)
    touchStartY.current = 0
  }

  const getTimeAgo = (dateString: string) => {
    const now = new Date().getTime()
    const created = new Date(dateString).getTime()
    const diff = now - created
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return '刚刚'
    if (hours < 24) return `${hours}小时前`
    return `${Math.floor(hours / 24)}天前`
  }

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-gray-50 overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 下拉刷新指示器 */}
      {pullDistance > 0 && (
        <div 
          className="flex items-center justify-center py-2 bg-blue-50 transition-all"
          style={{ height: `${pullDistance}px` }}
        >
          <RefreshCw 
            className={`w-5 h-5 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} 
          />
          <span className="ml-2 text-sm text-blue-600">
            {refreshing ? '刷新中...' : pullDistance > 60 ? '松开刷新' : '下拉刷新'}
          </span>
        </div>
      )}

      {/* 顶部导航 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">交易广场</h1>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">积分</div>
                    <div className="text-base font-bold text-blue-600">{user?.points}</div>
                  </div>
                  {user?.is_admin && (
                    <button
                      onClick={() => navigate('/admin')}
                      className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs"
                    >
                      管理
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm"
                >
                  登录/注册
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 游客提示 */}
      {!user && (
        <div className="bg-blue-50 border-b border-blue-100">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <p className="text-sm text-blue-700 text-center">
              👋 游客模式：您可以浏览信息，登录后可发布和查看联系方式
            </p>
          </div>
        </div>
      )}

      {/* 公告展示 */}
      {visibleAnnouncements.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-orange-100">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex items-start gap-2">
              <Megaphone className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 overflow-hidden">
                {visibleAnnouncements.map((ann, index) => (
                  <div key={ann.id} className={`flex items-start justify-between gap-2 ${index > 0 ? 'mt-1 pt-1 border-t border-orange-100' : ''}`}>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-orange-700">{ann.title}：</span>
                      <span className="text-sm text-orange-600">{ann.content}</span>
                    </div>
                    <button
                      onClick={() => handleCloseAnnouncement(ann.id)}
                      className="text-orange-400 hover:text-orange-600 flex-shrink-0"
                      title="关闭此公告"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 搜索栏 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                id="search-input"
                name="search"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value)
                  setShowSuggestions(e.target.value.length > 0)
                }}
                onFocus={() => searchKeyword.length > 0 && setShowSuggestions(true)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索交易信息（支持拼音首字母）..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              {searchKeyword && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              
              {/* 搜索建议下拉 */}
              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                    >
                      <Search className="w-3 h-3 text-gray-400" />
                      <span className="flex-1 truncate">{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => handleSearch()}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap"
            >
              搜索
            </button>
          </div>

          {/* 分类筛选 */}
          <div className="flex gap-2 mt-3 overflow-x-auto">
            <button
              onClick={() => setSelectedType(null)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                selectedType === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              全部
            </button>
            {Object.entries(tradeTypeMap).map(([type, info]) => (
              <button
                key={type}
                onClick={() => setSelectedType(Number(type))}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                  selectedType === Number(type)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {info.label}
              </button>
            ))}
          </div>

          {/* 热门关键词 - 显示交易信息数量最多的10个关键词 */}
          {hotKeywords.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs text-gray-500 font-medium">热门关键词</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {hotKeywords.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleHotKeywordClick(item.keyword)}
                    className="px-2.5 py-1 bg-gradient-to-r from-orange-50 to-yellow-50 text-orange-600 text-xs rounded-full border border-orange-100 hover:from-orange-100 hover:to-yellow-100 hover:border-orange-200 transition-all flex items-center gap-1"
                  >
                    <span className="truncate max-w-[80px]">{item.keyword}</span>
                    <span className="text-orange-400 text-[10px]">({item.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 交易板块卡片 */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <CategoryCards />
      </div>

      {/* 交易信息列表 */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">暂无交易信息</div>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`)}
                className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <h3 className="text-base font-semibold text-gray-900 flex-1 pr-2 line-clamp-1">
                    {post.title}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {/* 交割天数标识 - 仅做多/做空显示 */}
                    {(post.trade_type === 3 || post.trade_type === 4) && post.delivery_days && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-yellow-100 text-yellow-700 border border-yellow-200">
                        {post.delivery_days}天交割
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        tradeTypeMap[post.trade_type].color
                      }`}
                    >
                      {tradeTypeMap[post.trade_type].label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-red-600">
                      ¥{post.price}
                    </span>
                    <span className="text-xs text-gray-500">
                      查看: {post.view_count}/{post.view_limit}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {getTimeAgo(post.created_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-1">
                    {post.keywords.split(',').slice(0, 3).map((keyword, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                  
                  {/* 快捷交易按钮 */}
                  <button
                    onClick={(e) => handleQuickTrade(post, e)}
                    disabled={!user || user.points < 1}
                    className={`ml-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      !user || user.points < 1
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-500 text-white hover:bg-green-600 active:scale-95'
                    }`}
                  >
                    交易
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部导航栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-around py-2.5">
            <button
              onClick={() => navigate('/')}
              className="flex flex-col items-center text-blue-600"
            >
              <Home className="w-5 h-5" />
              <span className="text-xs mt-0.5">首页</span>
            </button>
            <button
              onClick={() => user ? navigate('/publish') : navigate('/login')}
              className="flex flex-col items-center text-gray-600"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="text-xs mt-0.5">发布</span>
            </button>
            <button
              onClick={() => user ? navigate('/profile') : navigate('/login')}
              className="flex flex-col items-center text-gray-600"
            >
              <User className="w-5 h-5" />
              <span className="text-xs mt-0.5">我的</span>
            </button>
            {user ? (
              <button
                onClick={() => {
                  if (window.confirm('确定要退出登录吗？')) {
                    logout()
                    navigate('/login')
                  }
                }}
                className="flex flex-col items-center text-gray-600"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-xs mt-0.5">退出</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="flex flex-col items-center text-gray-600"
              >
                <User className="w-5 h-5" />
                <span className="text-xs mt-0.5">登录</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="h-16"></div>
    </div>
  )
}
