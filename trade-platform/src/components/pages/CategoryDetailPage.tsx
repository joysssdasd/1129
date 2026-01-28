import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { ArrowLeft, Search, TrendingUp } from 'lucide-react'
import { useUser } from '../../contexts/UserContext'
import { toast } from '../../services/toastService'

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

export default function CategoryDetailPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useUser()
  
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [categoryName, setCategoryName] = useState(location.state?.categoryName || '板块详情')

  useEffect(() => {
    loadCategoryPosts()
  }, [categoryId])

  const loadCategoryPosts = async () => {
    try {
      setLoading(true)
      
      // 获取板块信息
      const { data: categoryData } = await supabase
        .from('categories')
        .select('name, icon, description')
        .eq('id', categoryId)
        .single()

      if (categoryData) {
        setCategoryName(categoryData.name)
      }

      // 获取该板块的交易信息
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('category_id', categoryId)
        .eq('status', 1)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPosts(data || [])
    } catch (error: any) {
      toast.error('加载失败', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickTrade = async (post: Post, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!user) {
      toast.error('请先登录')
      navigate('/login')
      return
    }

    if (user.points < 5) {
      toast.error('积分不足，请先充值')
      navigate('/profile')
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('view-contact', {
        body: { post_id: post.id, user_id: user.id }
      })

      if (error) throw error

      // 复制联系方式到剪贴板
      await navigator.clipboard.writeText(data.wechat_id)
      toast.success(`已复制联系方式：${data.wechat_id}`)

      // 更新用户积分
      if (user) {
        user.points -= 5
      }
    } catch (error: any) {
      toast.error('操作失败', error.message)
    }
  }

  const filteredPosts = posts.filter(post => {
    if (!searchKeyword) return true
    return post.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
           post.keywords?.toLowerCase().includes(searchKeyword.toLowerCase())
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-lg">{categoryName}</h1>
              <p className="text-xs text-gray-500">{filteredPosts.length} 条交易信息</p>
            </div>
          </div>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="搜索板块内的交易信息..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 交易信息列表 */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-500">加载中...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">该板块暂无交易信息</p>
            <button
              onClick={() => navigate('/publish')}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              发布第一条信息
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`)}
                className="bg-white p-3 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-base flex-1 line-clamp-2">{post.title}</h3>
                  <span className="text-red-600 font-bold text-base ml-2 whitespace-nowrap">
                    ¥{post.price}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded ${tradeTypeMap[post.trade_type]?.color || ''}`}>
                      {tradeTypeMap[post.trade_type]?.label || '未知'}
                    </span>
                    <span>查看 {post.view_count}/{post.view_limit}</span>
                  </div>
                  <button
                    onClick={(e) => handleQuickTrade(post, e)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                      user && user.points >= 5
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={!user || user.points < 5}
                  >
                    交易
                  </button>
                </div>

                {post.keywords && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.keywords.split(',').slice(0, 3).map((keyword, idx) => (
                      <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {keyword.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
