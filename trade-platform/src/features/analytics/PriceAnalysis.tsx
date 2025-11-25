import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Search, DollarSign, AlertCircle, BarChart3, RefreshCw } from 'lucide-react'
import { supabase } from '../../services/supabase'

interface KeywordData {
  keyword: string
  avgPrice: number
  minPrice: number
  maxPrice: number
  priceChange: number
  priceChangePercent: number
  volume: number
  trend: 'up' | 'down' | 'stable'
  priceHistory: Array<{
    date: string
    price: number
    volume: number
  }>
}

interface PriceAlert {
  keyword: string
  type: 'spike' | 'drop' | 'volatility'
  message: string
  severity: 'high' | 'medium' | 'low'
}

export default function PriceAnalysis() {
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [selectedKeyword, setSelectedKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [sortField, setSortField] = useState<'price' | 'change' | 'volume'>('volume')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadPriceAnalysis()
  }, [selectedKeyword, sortField, sortOrder])

  const loadPriceAnalysis = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('get-price-analysis', {
        body: {
          keyword: selectedKeyword,
          days: 7
        }
      })

      if (error) throw error

      if (data?.data) {
        setKeywords(data.data.keywords || [])
        setPriceAlerts(data.data.alerts || [])
      } else {
        // 降级到前端计算
        await calculatePriceAnalysisFrontend()
      }
    } catch (error) {
      console.error('加载价格分析数据失败:', error)
      await calculatePriceAnalysisFrontend()
    } finally {
      setLoading(false)
    }
  }

  const calculatePriceAnalysisFrontend = async () => {
    try {
      // 获取最近7天的发布数据
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: postsData } = await supabase
        .from('posts')
        .select('title, price, keywords, created_at')
        .gte('created_at', sevenDaysAgo)
        .eq('status', 1)

      if (!postsData || postsData.length === 0) {
        setKeywords([])
        setPriceAlerts([])
        return
      }

      // 提取关键词并聚合价格数据
      const keywordMap = new Map<string, {
        prices: number[]
        dates: string[]
        titles: string[]
      }>()

      postsData.forEach(post => {
        const postKeywords = post.keywords || []
        const titleWords = post.title.toLowerCase().split(/[\s,，。、]+/)
        const allKeywords = [...postKeywords, ...titleWords.filter(word => word.length > 1)]

        allKeywords.forEach(keyword => {
          if (!keywordMap.has(keyword)) {
            keywordMap.set(keyword, {
              prices: [],
              dates: [],
              titles: []
            })
          }
          const keywordData = keywordMap.get(keyword)!
          keywordData.prices.push(post.price)
          keywordData.dates.push(post.created_at)
          keywordData.titles.push(post.title)
        })
      })

      // 计算每个关键词的统计数据
      const keywordData: KeywordData[] = Array.from(keywordMap.entries())
        .map(([keyword, data]) => {
          const prices = data.prices.sort((a, b) => new Date(data.dates[data.prices.indexOf(a)]).getTime() - new Date(data.dates[data.prices.indexOf(b)]).getTime())

          const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
          const minPrice = Math.min(...prices)
          const maxPrice = Math.max(...prices)

          // 计算价格变化
          const firstPrice = prices[0] || avgPrice
          const lastPrice = prices[prices.length - 1] || avgPrice
          const priceChange = lastPrice - firstPrice
          const priceChangePercent = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0

          // 确定趋势
          let trend: 'up' | 'down' | 'stable' = 'stable'
          if (Math.abs(priceChangePercent) > 10) {
            trend = priceChangePercent > 0 ? 'up' : 'down'
          }

          // 构建价格历史
          const priceHistory = prices.map((price, index) => ({
            date: new Date(data.dates[index]).toLocaleDateString(),
            price,
            volume: 1
          }))

          return {
            keyword,
            avgPrice,
            minPrice,
            maxPrice,
            priceChange,
            priceChangePercent,
            volume: prices.length,
            trend,
            priceHistory
          }
        })
        .filter(data => data.volume >= 2) // 至少要有2个数据点
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 20) // 只取前20个

      // 生成价格警报
      const alerts: PriceAlert[] = []
      keywordData.forEach(data => {
        if (data.priceChangePercent > 30) {
          alerts.push({
            keyword: data.keyword,
            type: 'spike',
            message: `${data.keyword} 价格上涨 ${data.priceChangePercent.toFixed(1)}%`,
            severity: 'high'
          })
        } else if (data.priceChangePercent < -30) {
          alerts.push({
            keyword: data.keyword,
            type: 'drop',
            message: `${data.keyword} 价格下跌 ${Math.abs(data.priceChangePercent).toFixed(1)}%`,
            severity: 'high'
          }
          )
        }

        const priceVariation = ((data.maxPrice - data.minPrice) / data.avgPrice) * 100
        if (priceVariation > 50) {
          alerts.push({
            keyword: data.keyword,
            type: 'volatility',
            message: `${data.keyword} 价格波动较大 (${priceVariation.toFixed(1)}%)`,
            severity: 'medium'
          })
        }
      })

      setKeywords(keywordData)
      setPriceAlerts(alerts.slice(0, 5)) // 只显示前5个警报
    } catch (error) {
      console.error('前端价格分析计算失败:', error)
      setKeywords([])
      setPriceAlerts([])
    }
  }

  const handleSort = (field: 'price' | 'change' | 'volume') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const getSortedKeywords = () => {
    const sorted = [...keywords]
    switch (sortField) {
      case 'price':
        return sorted.sort((a, b) =>
          sortOrder === 'desc' ? b.avgPrice - a.avgPrice : a.avgPrice - b.avgPrice
        )
      case 'change':
        return sorted.sort((a, b) =>
          sortOrder === 'desc' ? b.priceChangePercent - a.priceChangePercent : a.priceChangePercent - b.priceChangePercent
        )
      case 'volume':
        return sorted.sort((a, b) =>
          sortOrder === 'desc' ? b.volume - a.volume : a.volume - b.volume
        )
      default:
        return sorted
    }
  }

  const filteredKeywords = getSortedKeywords().filter(keyword =>
    keyword.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">关键词价格波动分析</h2>
        <button
          onClick={loadPriceAnalysis}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          <RefreshCw className="w-4 h-4" />
          刷新分析
        </button>
      </div>

      {/* 价格警报 */}
      {priceAlerts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            价格警报
          </h3>
          <div className="space-y-2">
            {priceAlerts.map((alert, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  alert.severity === 'high'
                    ? 'bg-red-50 border-red-200'
                    : alert.severity === 'medium'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {alert.type === 'spike' && <TrendingUp className="w-4 h-4 text-red-500" />}
                  {alert.type === 'drop' && <TrendingDown className="w-4 h-4 text-blue-500" />}
                  {alert.type === 'volatility' && <BarChart3 className="w-4 h-4 text-yellow-500" />}
                  <span className="font-medium">{alert.keyword}</span>
                  <span className="text-sm text-gray-600">{alert.message}</span>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  alert.severity === 'high'
                    ? 'bg-red-100 text-red-700'
                    : alert.severity === 'medium'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {alert.severity === 'high' ? '高' : alert.severity === 'medium' ? '中' : '低'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 搜索和筛选 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索关键词..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 排序按钮 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">排序:</span>
          <button
            onClick={() => handleSort('volume')}
            className={`px-3 py-1 text-sm rounded-lg ${
              sortField === 'volume'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            信息量 {sortField === 'volume' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => handleSort('price')}
            className={`px-3 py-1 text-sm rounded-lg ${
              sortField === 'price'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            均价 {sortField === 'price' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => handleSort('change')}
            className={`px-3 py-1 text-sm rounded-lg ${
              sortField === 'change'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            涨幅 {sortField === 'change' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
        </div>
      </div>

      {/* 关键词价格数据 */}
      <div className="bg-white border border-gray-200 rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-2 text-gray-600">分析价格数据中...</span>
          </div>
        ) : filteredKeywords.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>暂无价格数据</p>
            <p className="text-sm mt-2">需要更多的交易信息才能进行分析</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    关键词
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    均价
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    价格区间
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    涨跌幅
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    信息量
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    趋势
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredKeywords.map((keywordData, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {keywordData.keyword}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">
                        ¥{keywordData.avgPrice.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-600">
                        ¥{keywordData.minPrice.toFixed(2)} - ¥{keywordData.maxPrice.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                        keywordData.priceChangePercent > 0
                          ? 'text-green-600'
                          : keywordData.priceChangePercent < 0
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}>
                        {keywordData.priceChangePercent > 0 && <TrendingUp className="w-3 h-3" />}
                        {keywordData.priceChangePercent < 0 && <TrendingDown className="w-3 h-3" />}
                        {Math.abs(keywordData.priceChangePercent).toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">
                        {keywordData.volume}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        keywordData.trend === 'up'
                          ? 'bg-green-100 text-green-800'
                          : keywordData.trend === 'down'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {keywordData.trend === 'up' ? '上涨' :
                         keywordData.trend === 'down' ? '下跌' : '稳定'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分析说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">价格分析说明</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 基于最近7天的交易信息进行价格分析</li>
              <li>• 涨跌幅超过30%会触发高优先级警报</li>
              <li>• 价格波动超过50%会触发波动性警报</li>
              <li>• 仅显示有足够数据的关键词（至少2条信息）</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}