import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { TrendingUp, Flame } from 'lucide-react'

interface Category {
  id: string
  name: string
  icon: string
  description: string
  post_count: number
  view_count: number
  deal_count: number
  heat_score?: number
}

export default function CategoryCards() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error

      // 计算热度分数
      const categoriesWithHeat = (data || []).map(cat => {
        // 热度计算公式：交易数量×0.3 + 查看次数×0.2 + 成交次数×0.3 + 最近活跃度×0.2
        const heat_score = 
          (cat.post_count * 0.3) + 
          (cat.view_count * 0.2) + 
          (cat.deal_count * 0.3) + 
          (cat.post_count * 0.2) // 简化版，实际可以查询最近7天的数据
        
        return { ...cat, heat_score }
      })

      setCategories(categoriesWithHeat)
    } catch (error) {
      console.error('加载板块失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getHeatColor = (score: number) => {
    if (score > 80) return 'from-red-500 to-orange-500' // 超级热门
    if (score > 60) return 'from-orange-500 to-yellow-500' // 很热门
    if (score > 40) return 'from-yellow-500 to-green-500' // 较热门
    if (score > 20) return 'from-green-500 to-blue-500' // 一般
    return 'from-blue-500 to-purple-500' // 冷门
  }

  const getHeatLevel = (score: number) => {
    if (score > 80) return { text: '超级热门', flames: 5 }
    if (score > 60) return { text: '很热门', flames: 4 }
    if (score > 40) return { text: '较热门', flames: 3 }
    if (score > 20) return { text: '一般', flames: 2 }
    return { text: '冷门', flames: 1 }
  }

  const handleCategoryClick = (categoryId: string, categoryName: string) => {
    // 跳转到板块详情页，传递板块ID
    navigate(`/category/${categoryId}`, { state: { categoryName } })
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (categories.length === 0) {
    return null
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-500" />
          交易板块
        </h2>
        <span className="text-xs text-gray-500">点击查看详情</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {categories.map((category) => {
          const heatLevel = getHeatLevel(category.heat_score || 0)
          const heatColor = getHeatColor(category.heat_score || 0)

          return (
            <div
              key={category.id}
              onClick={() => handleCategoryClick(category.id, category.name)}
              className="relative bg-white rounded-lg border-2 border-gray-200 p-4 cursor-pointer 
                       hover:border-blue-400 hover:shadow-lg transition-all duration-200 
                       active:scale-95"
            >
              {/* 热度背景渐变 */}
              <div 
                className={`absolute inset-0 bg-gradient-to-br ${heatColor} opacity-5 rounded-lg`}
              />

              {/* 内容 */}
              <div className="relative z-10">
                {/* 图标和名称 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl">{category.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm">{category.name}</h3>
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {category.description}
                    </p>
                  </div>
                </div>

                {/* 统计信息 */}
                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <span>{category.post_count} 条信息</span>
                  <span>{category.view_count} 次查看</span>
                </div>

                {/* 热度指示器 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: heatLevel.flames }).map((_, i) => (
                      <Flame key={i} size={12} className="text-orange-500 fill-orange-500" />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${
                    category.heat_score! > 60 ? 'text-red-600' : 
                    category.heat_score! > 40 ? 'text-orange-600' : 
                    'text-gray-600'
                  }`}>
                    {heatLevel.text}
                  </span>
                </div>
              </div>

              {/* 右上角热度分数 */}
              <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-bold">
                {Math.round(category.heat_score || 0)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
