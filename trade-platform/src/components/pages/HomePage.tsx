import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { supabase } from '../../services/supabase'
import { Home, PlusCircle, User, Search, LogOut, RefreshCw } from 'lucide-react'

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
}

const tradeTypeMap: { [key: number]: { label: string; color: string } } = {
  1: { label: '求购', color: 'bg-green-100 text-green-700' },
  2: { label: '出售', color: 'bg-blue-100 text-blue-700' },
  3: { label: '做多', color: 'bg-red-100 text-red-700' },
  4: { label: '做空', color: 'bg-purple-100 text-purple-700' }
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedType, setSelectedType] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const { user, setUser, logout } = useUser()
  const navigate = useNavigate()
  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadPosts()
  }, [selectedType])

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
      console.error('加载失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      loadPosts()
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 1)
        .or(`title.ilike.%${searchKeyword}%,keywords.ilike.%${searchKeyword}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setPosts(data || [])
    } catch (error) {
      console.error('搜索失败:', error)
    } finally {
      setLoading(false)
    }
  }

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
            </div>
          </div>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索交易信息..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
            <button
              onClick={handleSearch}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              搜索
            </button>
          </div>

          {/* 分类筛选 */}
          <div className="flex gap-2 mt-2 overflow-x-auto">
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
        </div>
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
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                      tradeTypeMap[post.trade_type].color
                    }`}
                  >
                    {tradeTypeMap[post.trade_type].label}
                  </span>
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
              onClick={() => navigate('/publish')}
              className="flex flex-col items-center text-gray-600"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="text-xs mt-0.5">发布</span>
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex flex-col items-center text-gray-600"
            >
              <User className="w-5 h-5" />
              <span className="text-xs mt-0.5">我的</span>
            </button>
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
          </div>
        </div>
      </div>

      <div className="h-16"></div>
    </div>
  )
}
