import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { TrendingUp, Activity } from 'lucide-react'

interface Category {
  id: string
  name: string
  icon: string
  description: string
  post_count: number
  view_count: number
  deal_count: number
  heat_score?: number
  recent_posts?: number // 24小时内新增帖子数
}

export default function CategoryCards() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(4) // 默认显示4个
  const navigate = useNavigate()

  useEffect(() => {
    loadDisplaySettings()
    loadCategories()
  }, [])

  // 加载显示数量设置
  const loadDisplaySettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'category_display_count')
        .single()
      
      if (data?.value) {
        setDisplayCount(parseInt(data.value) || 4)
      }
    } catch (error) {
      // 使用默认值
    }
  }

  const loadCategories = async () => {
    try {
      // 获取板块基础信息
      const { data: categoriesData, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error

      // 获取24小时内各板块的帖子数量
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: recentPostsData } = await supabase
        .from('posts')
        .select('category_id')
        .eq('status', 1)
        .gte('created_at', oneDayAgo)

      // 统计各板块24小时内的帖子数
      const recentPostsCount: Record<string, number> = {}
      recentPostsData?.forEach(post => {
        if (post.category_id) {
          recentPostsCount[post.category_id] = (recentPostsCount[post.category_id] || 0) + 1
        }
      })

      // 计算热度分数（基于24小时活跃度）
      const categoriesWithHeat = (categoriesData || []).map(cat => {
        const recentPosts = recentPostsCount[cat.id] || 0
        // 热度计算：24小时新帖×50% + 总帖子数×20% + 查看次数×20% + 成交次数×10%
        const heat_score = 
          (recentPosts * 5) + // 24小时新帖权重最高
          (cat.post_count * 0.2) + 
          (cat.view_count * 0.1) + 
          (cat.deal_count * 0.3)
        
        return { ...cat, heat_score, recent_posts: recentPosts }
      })

      setCategories(categoriesWithHeat)
    } catch (error) {
      console.error('加载板块失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 根据热度获取背景颜色（热力图效果）
  const getHeatBgColor = (score: number, maxScore: number) => {
    if (maxScore === 0) return 'bg-blue-50'
    const ratio = score / maxScore
    if (ratio > 0.8) return 'bg-red-500'
    if (ratio > 0.6) return 'bg-orange-500'
    if (ratio > 0.4) return 'bg-yellow-500'
    if (ratio > 0.2) return 'bg-green-500'
    return 'bg-blue-500'
  }

  // 根据热度获取文字颜色
  const getTextColor = (score: number, maxScore: number) => {
    if (maxScore === 0) return 'text-gray-800'
    const ratio = score / maxScore
    if (ratio > 0.4) return 'text-white'
    return 'text-white'
  }

  // 根据热度获取透明度
  const getOpacity = (score: number, maxScore: number) => {
    if (maxScore === 0) return 0.3
    const ratio = score / maxScore
    return Math.max(0.4, Math.min(1, 0.4 + ratio * 0.6))
  }

  const handleCategoryClick = (categoryId: string, categoryName: string) => {
    navigate(`/category/${categoryId}`, { state: { categoryName } })
  }

  if (loading) {
    return (
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: displayCount }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (categories.length === 0) {
    return null
  }

  // 只显示设定数量的板块
  const displayCategories = categories.slice(0, displayCount)
  const maxScore = Math.max(...displayCategories.map(c => c.heat_score || 0), 1)

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Activity size={18} className="text-red-500" />
          热门板块
        </h2>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span>热</span>
          <span className="w-2 h-2 rounded-full bg-blue-500 ml-2"></span>
          <span>冷</span>
        </div>
      </div>

      {/* 热力图网格 */}
      <div className={`grid gap-2 ${displayCount === 6 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {displayCategories.map((category) => {
          const bgColor = getHeatBgColor(category.heat_score || 0, maxScore)
          const textColor = getTextColor(category.heat_score || 0, maxScore)
          const opacity = getOpacity(category.heat_score || 0, maxScore)

          return (
            <div
              key={category.id}
              onClick={() => handleCategoryClick(category.id, category.name)}
              className={`relative rounded-lg p-3 cursor-pointer transition-all duration-200 
                         hover:scale-[1.02] hover:shadow-lg active:scale-95 overflow-hidden
                         ${bgColor}`}
              style={{ opacity }}
            >
              {/* 内容 */}
              <div className={`relative z-10 ${textColor}`}>
                {/* 图标和名称 */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{category.icon}</span>
                  <h3 className="font-bold text-sm truncate flex-1">{category.name}</h3>
                </div>

                {/* 统计信息 */}
                <div className="flex items-center justify-between text-xs opacity-90">
                  <span>{category.post_count} 条</span>
                  {category.recent_posts && category.recent_posts > 0 && (
                    <span className="flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded">
                      <TrendingUp size={10} />
                      +{category.recent_posts}
                    </span>
                  )}
                </div>
              </div>

              {/* 热度指示条 */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
                <div 
                  className="h-full bg-white/50 transition-all duration-500"
                  style={{ width: `${(category.heat_score || 0) / maxScore * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* 查看更多提示 */}
      {categories.length > displayCount && (
        <div className="text-center mt-2">
          <span className="text-xs text-gray-400">
            还有 {categories.length - displayCount} 个板块
          </span>
        </div>
      )}
    </div>
  )
}
