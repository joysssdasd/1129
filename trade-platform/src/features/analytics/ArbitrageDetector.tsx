import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, AlertTriangle, CheckCircle, Clock, RefreshCw, Filter } from 'lucide-react'
import { supabase } from '../../services/supabase'

interface ArbitrageOpportunity {
  id: string
  keyword: string
  sellPrice: number
  buyPrice: number
  profit: number
  profitPercent: number
  sellPost: {
    id: string
    title: string
    price: number
    trade_type: number
    created_at: string
  }
  buyPost: {
    id: string
    title: string
    price: number
    trade_type: number
    created_at: string
  }
  confidence: 'high' | 'medium' | 'low'
  riskLevel: 'low' | 'medium' | 'high'
  matchedAt: string
}

interface ArbitrageStats {
  totalOpportunities: number
  avgProfitPercent: number
  highConfidenceCount: number
  totalPotentialProfit: number
}

export default function ArbitrageDetector() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([])
  const [stats, setStats] = useState<ArbitrageStats>({
    totalOpportunities: 0,
    avgProfitPercent: 0,
    highConfidenceCount: 0,
    totalPotentialProfit: 0
  })
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [minProfitPercent, setMinProfitPercent] = useState(10)

  useEffect(() => {
    detectArbitrageOpportunities()
  }, [filter, minProfitPercent])

  const detectArbitrageOpportunities = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('detect-arbitrage', {
        body: {
          minProfitPercent,
          maxAgeHours: 24
        }
      })

      if (error) throw error

      if (data?.data) {
        setOpportunities(data.data.opportunities || [])
        setStats(data.data.stats || {
          totalOpportunities: data.data.opportunities?.length || 0,
          avgProfitPercent: 0,
          highConfidenceCount: 0,
          totalPotentialProfit: 0
        })
      } else {
        // 降级到前端计算
        await calculateArbitrageFrontend()
      }
    } catch (error) {
      console.error('套利检测失败:', error)
      await calculateArbitrageFrontend()
    } finally {
      setLoading(false)
    }
  }

  const calculateArbitrageFrontend = async () => {
    try {
      // 获取最近24小时的有效信息
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: postsData } = await supabase
        .from('posts')
        .select('id, title, price, keywords, trade_type, created_at')
        .gte('created_at', oneDayAgo)
        .eq('status', 1)
        .order('created_at', { ascending: false })

      if (!postsData || postsData.length < 2) {
        setOpportunities([])
        setStats({
          totalOpportunities: 0,
          avgProfitPercent: 0,
          highConfidenceCount: 0,
          totalPotentialProfit: 0
        })
        return
      }

      // 分离买入和卖出信息
      const sellPosts = postsData.filter(post => post.trade_type === 2) // 卖出
      const buyPosts = postsData.filter(post => post.trade_type === 1)  // 买入

      if (sellPosts.length === 0 || buyPosts.length === 0) {
        setOpportunities([])
        setStats({
          totalOpportunities: 0,
          avgProfitPercent: 0,
          highConfidenceCount: 0,
          totalPotentialProfit: 0
        })
        return
      }

      // 寻找套利机会
      const opportunities: ArbitrageOpportunity[] = []

      sellPosts.forEach(sellPost => {
        const sellKeywords = sellPost.keywords || []
        const sellTitleWords = sellPost.title.toLowerCase().split(/[\s,，。、]+/)
        const allSellKeywords = [...sellKeywords, ...sellTitleWords.filter(word => word.length > 1)]

        buyPosts.forEach(buyPost => {
          const buyKeywords = buyPost.keywords || []
          const buyTitleWords = buyPost.title.toLowerCase().split(/[\s,，。、]+/)
          const allBuyKeywords = [...buyKeywords, ...buyTitleWords.filter(word => word.length > 1)]

          // 计算关键词匹配度
          const commonKeywords = allSellKeywords.filter(keyword =>
            allBuyKeywords.some(buyKeyword =>
              buyKeyword.toLowerCase() === keyword.toLowerCase() ||
              buyKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
              keyword.toLowerCase().includes(buyKeyword.toLowerCase())
            )
          )

          if (commonKeywords.length > 0) {
            const profit = sellPost.price - buyPost.price
            const profitPercent = (profit / buyPost.price) * 100

            if (profit > 0 && profitPercent >= minProfitPercent) {
              // 计算置信度
              let confidence: 'high' | 'medium' | 'low' = 'low'
              let riskLevel: 'low' | 'medium' | 'high' = 'high'

              if (commonKeywords.length >= 2 && profitPercent >= 20) {
                confidence = 'high'
                riskLevel = 'low'
              } else if (commonKeywords.length >= 1 && profitPercent >= 15) {
                confidence = 'medium'
                riskLevel = 'medium'
              }

              opportunities.push({
                id: `${sellPost.id}-${buyPost.id}`,
                keyword: commonKeywords[0],
                sellPrice: sellPost.price,
                buyPrice: buyPost.price,
                profit,
                profitPercent,
                sellPost,
                buyPost,
                confidence,
                riskLevel,
                matchedAt: new Date().toISOString()
              })
            }
          }
        })
      })

      // 按利润率排序
      opportunities.sort((a, b) => b.profitPercent - a.profitPercent)

      // 计算统计数据
      const totalPotentialProfit = opportunities.reduce((sum, opp) => sum + opp.profit, 0)
      const avgProfitPercent = opportunities.length > 0
        ? opportunities.reduce((sum, opp) => sum + opp.profitPercent, 0) / opportunities.length
        : 0
      const highConfidenceCount = opportunities.filter(opp => opp.confidence === 'high').length

      setOpportunities(opportunities.slice(0, 20)) // 最多显示20个机会
      setStats({
        totalOpportunities: opportunities.length,
        avgProfitPercent,
        highConfidenceCount,
        totalPotentialProfit
      })
    } catch (error) {
      console.error('前端套利计算失败:', error)
      setOpportunities([])
      setStats({
        totalOpportunities: 0,
        avgProfitPercent: 0,
        highConfidenceCount: 0,
        totalPotentialProfit: 0
      })
    }
  }

  const filteredOpportunities = opportunities.filter(opp => {
    if (filter === 'all') return true
    return opp.confidence === filter
  })

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return 'text-green-600 bg-green-100'
      case 'medium':
        return 'text-yellow-600 bg-yellow-100'
      case 'high':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">套利机会检测</h2>
        <button
          onClick={detectArbitrageOpportunities}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          <RefreshCw className="w-4 h-4" />
          重新检测
        </button>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">套利机会</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalOpportunities}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">平均利润率</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgProfitPercent.toFixed(1)}%</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">高置信度</p>
              <p className="text-2xl font-bold text-gray-900">{stats.highConfidenceCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">潜在总利润</p>
              <p className="text-2xl font-bold text-gray-900">¥{stats.totalPotentialProfit.toFixed(0)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* 筛选控制 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700">置信度筛选:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  filter === 'all'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setFilter('high')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  filter === 'high'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                高置信度
              </button>
              <button
                onClick={() => setFilter('medium')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  filter === 'medium'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                中置信度
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">最低利润率:</span>
            <input
              type="number"
              value={minProfitPercent}
              onChange={(e) => setMinProfitPercent(Number(e.target.value))}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              min="1"
              max="100"
            />
            <span className="text-sm text-gray-600">%</span>
          </div>
        </div>
      </div>

      {/* 套利机会列表 */}
      <div className="bg-white border border-gray-200 rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-2 text-gray-600">检测套利机会中...</span>
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>暂未发现套利机会</p>
            <p className="text-sm mt-2">可以尝试降低最低利润率要求</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredOpportunities.map((opportunity) => (
              <div key={opportunity.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                      {opportunity.keyword}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(opportunity.confidence)}`}>
                      {opportunity.confidence === 'high' ? '高置信度' :
                       opportunity.confidence === 'medium' ? '中置信度' : '低置信度'}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskLevelColor(opportunity.riskLevel)}`}>
                      {opportunity.riskLevel === 'low' ? '低风险' :
                       opportunity.riskLevel === 'medium' ? '中风险' : '高风险'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      ¥{opportunity.profit.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">
                      利润率: {opportunity.profitPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 卖出信息 */}
                  <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-700">卖出价格</span>
                      <span className="text-lg font-bold text-green-900">
                        ¥{opportunity.sellPrice}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">{opportunity.sellPost.title}</h4>
                    <div className="text-xs text-gray-500">
                      发布时间: {new Date(opportunity.sellPost.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* 买入信息 */}
                  <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-700">买入价格</span>
                      <span className="text-lg font-bold text-blue-900">
                        ¥{opportunity.buyPrice}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">{opportunity.buyPost.title}</h4>
                    <div className="text-xs text-gray-500">
                      发布时间: {new Date(opportunity.buyPost.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-400">
                  检测时间: {new Date(opportunity.matchedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-900 mb-1">套利风险提示</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• 套利机会基于关键词匹配，不代表实际商品完全一致</li>
              <li>• 价格可能随时间变化，实际利润可能有所偏差</li>
              <li>• 请自行核实商品详情和交易条件</li>
              <li>• 高利润率通常伴随较高风险，请谨慎评估</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}