import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Users, FileText, DollarSign, Eye } from 'lucide-react'
import { supabase } from '../../services/supabase'
import HourlyStats from './HourlyStats'
import PriceAnalysis from './PriceAnalysis'
import ArbitrageDetector from './ArbitrageDetector'
import DailyReport from './DailyReport'
import KLineChart from '../KLineChart'

interface AnalyticsStats {
  totalUsers: number
  totalPosts: number
  totalRevenue: number
  activeUsers: number
  pendingRecharges: number
  completedTransactions: number
}

export default function AnalyticsDashboard() {
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState('overview')
  const [stats, setStats] = useState<AnalyticsStats>({
    totalUsers: 0,
    totalPosts: 0,
    totalRevenue: 0,
    activeUsers: 0,
    pendingRecharges: 0,
    completedTransactions: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalyticsData()
  }, [activeAnalyticsTab])

  const loadAnalyticsData = async () => {
    setLoading(true)
    try {
      const [
        usersResult,
        postsResult,
        rechargeResult,
        activeUsersResult,
        completedTransactionsResult
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('posts').select('id', { count: 'exact' }),
        supabase.from('recharge_requests').select('amount', { count: 'exact' }).eq('status', 1),
        supabase.from('user_activity').select('user_id', { count: 'exact' }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('posts').select('id', { count: 'exact' }).eq('status', 2)
      ])

      const { data: revenueData } = await supabase
        .from('recharge_requests')
        .select('amount')
        .eq('status', 1)

      const totalRevenue = revenueData?.reduce((sum, req) => sum + (req.amount || 0), 0) || 0

      setStats({
        totalUsers: usersResult.count || 0,
        totalPosts: postsResult.count || 0,
        totalRevenue,
        activeUsers: activeUsersResult.count || 0,
        pendingRecharges: 0,
        completedTransactions: completedTransactionsResult.count || 0
      })
    } catch (error) {
      console.error('加载分析数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const analyticsTabs = [
    { id: 'overview', name: '总览', icon: BarChart3 },
    { id: 'hourly', name: '小时统计', icon: TrendingUp },
    { id: 'price', name: '价格分析', icon: DollarSign },
    { id: 'arbitrage', name: '套利检测', icon: Eye },
    { id: 'daily', name: '日报', icon: FileText },
    { id: 'kline', name: 'K线图', icon: TrendingUp }
  ]

  return (
    <div className="space-y-6">
      {/* 分析功能标签页 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1 p-2" aria-label="数据分析标签">
            {analyticsTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveAnalyticsTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeAnalyticsTab === tab.id
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* 统计概览卡片 */}
      {activeAnalyticsTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">总用户数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">总信息数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPosts}</p>
              </div>
              <FileText className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">总收入</p>
                <p className="text-2xl font-bold text-gray-900">¥{stats.totalRevenue}</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">活跃用户</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
              </div>
              <Users className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">待审核</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingRecharges}</p>
              </div>
              <Eye className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">成交数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedTransactions}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading && activeAnalyticsTab !== 'overview' ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-2 text-gray-600">加载数据中...</span>
          </div>
        ) : (
          <div className="p-6">
            {activeAnalyticsTab === 'overview' && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">数据分析总览</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 这里可以添加快速统计图表 */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2">快速统计</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">今日新增用户:</span>
                        <span className="font-medium">--</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">今日新增信息:</span>
                        <span className="font-medium">--</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">今日充值金额:</span>
                        <span className="font-medium">--</span>
                      </div>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2">系统状态</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">数据库状态:</span>
                        <span className="font-medium text-green-600">正常</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">API响应:</span>
                        <span className="font-medium text-green-600">正常</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">最后更新:</span>
                        <span className="font-medium">{new Date().toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeAnalyticsTab === 'hourly' && <HourlyStats />}
            {activeAnalyticsTab === 'price' && <PriceAnalysis />}
            {activeAnalyticsTab === 'arbitrage' && <ArbitrageDetector />}
            {activeAnalyticsTab === 'daily' && <DailyReport />}
            {activeAnalyticsTab === 'kline' && <KLineChart />}
          </div>
        )}
      </div>
    </div>
  )
}