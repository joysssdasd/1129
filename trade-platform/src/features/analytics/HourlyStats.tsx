import { useState, useEffect } from 'react'
import { Clock, Users, FileText, DollarSign, TrendingUp, RefreshCw } from 'lucide-react'
import { supabase } from '../../services/supabase'

interface HourlyData {
  hour: string
  newUsers: number
  newPosts: number
  rechargePoints: number
  activeUsers: number
}

export default function HourlyStats() {
  const [data, setData] = useState<HourlyData[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState('today')

  useEffect(() => {
    loadHourlyData()
  }, [dateRange])

  const loadHourlyData = async () => {
    setLoading(true)
    try {
      const { data: hourlyData, error } = await supabase.functions.invoke('get-hourly-stats', {
        body: { dateRange }
      })

      if (error) throw error

      // 如果没有专门的后端函数，使用前端聚合数据
      if (!hourlyData?.data) {
        await generateHourlyDataFrontend()
      } else {
        setData(hourlyData.data)
      }
    } catch (error) {
      console.error('加载小时统计数据失败:', error)
      // 降级到前端计算
      await generateHourlyDataFrontend()
    } finally {
      setLoading(false)
    }
  }

  const generateHourlyDataFrontend = async () => {
    const now = new Date()
    const hours = []
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 最近24小时

    // 生成24小时的时间标签
    for (let i = 0; i < 24; i++) {
      const hour = new Date(startDate.getTime() + i * 60 * 60 * 1000)
      hours.push({
        hour: hour.getHours().toString().padStart(2, '0') + ':00',
        newUsers: 0,
        newPosts: 0,
        rechargePoints: 0,
        activeUsers: 0
      })
    }

    try {
      // 获取用户数据
      const { data: usersData } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', startDate.toISOString())

      // 获取发布数据
      const { data: postsData } = await supabase
        .from('posts')
        .select('created_at')
        .gte('created_at', startDate.toISOString())

      // 获取充值数据
      const { data: rechargeData } = await supabase
        .from('recharge_requests')
        .select('created_at, points, status')
        .gte('created_at', startDate.toISOString())
        .eq('status', 1)

      // 聚合数据到小时
      usersData?.forEach(user => {
        const hour = new Date(user.created_at).getHours()
        const index = hour >= startDate.getHours() ? hour - startDate.getHours() : hour + (24 - startDate.getHours())
        if (index >= 0 && index < 24) {
          hours[index].newUsers++
        }
      })

      postsData?.forEach(post => {
        const hour = new Date(post.created_at).getHours()
        const index = hour >= startDate.getHours() ? hour - startDate.getHours() : hour + (24 - startDate.getHours())
        if (index >= 0 && index < 24) {
          hours[index].newPosts++
        }
      })

      rechargeData?.forEach(recharge => {
        const hour = new Date(recharge.created_at).getHours()
        const index = hour >= startDate.getHours() ? hour - startDate.getHours() : hour + (24 - startDate.getHours())
        if (index >= 0 && index < 24) {
          hours[index].rechargePoints += recharge.points || 0
        }
      })

      setData(hours)
    } catch (error) {
      console.error('生成前端数据失败:', error)
      setData(hours)
    }
  }

  const getTotalStats = () => {
    return {
      totalNewUsers: data.reduce((sum, d) => sum + d.newUsers, 0),
      totalNewPosts: data.reduce((sum, d) => sum + d.newPosts, 0),
      totalRechargePoints: data.reduce((sum, d) => sum + d.rechargePoints, 0),
      totalActiveUsers: data.reduce((sum, d) => sum + d.activeUsers, 0),
      avgNewUsers: (data.reduce((sum, d) => sum + d.newUsers, 0) / 24).toFixed(1),
      avgNewPosts: (data.reduce((sum, d) => sum + d.newPosts, 0) / 24).toFixed(1),
      avgRechargePoints: Math.round(data.reduce((sum, d) => sum + d.rechargePoints, 0) / 24)
    }
  }

  const stats = getTotalStats()
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.newUsers, d.newPosts, d.rechargePoints / 100, d.activeUsers))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">按小时数据统计</h2>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="today">最近24小时</option>
            <option value="yesterday">昨天</option>
            <option value="week">最近7天</option>
          </select>
          <button
            onClick={loadHourlyData}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            <RefreshCw className="w-4 h-4" />
            刷新数据
          </button>
        </div>
      </div>

      {/* 总计统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">新增用户</p>
              <p className="text-2xl font-bold text-blue-900">{stats.totalNewUsers}</p>
              <p className="text-xs text-blue-700">平均 {stats.avgNewUsers}/小时</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">新增信息</p>
              <p className="text-2xl font-bold text-green-900">{stats.totalNewPosts}</p>
              <p className="text-xs text-green-700">平均 {stats.avgNewPosts}/小时</p>
            </div>
            <FileText className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600">充值积分</p>
              <p className="text-2xl font-bold text-purple-900">{stats.totalRechargePoints}</p>
              <p className="text-xs text-purple-700">平均 {stats.avgRechargePoints}/小时</p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">活跃用户</p>
              <p className="text-2xl font-bold text-orange-900">{stats.totalActiveUsers}</p>
              <p className="text-xs text-orange-700">总计统计</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* 小时数据图表 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">24小时数据趋势</h3>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-2 text-gray-600">加载数据中...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 图表区域 */}
            <div className="h-64 relative">
              <div className="absolute inset-0 flex items-end justify-between gap-1">
                {data.map((hourData, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col gap-1">
                      {/* 新用户柱状图 */}
                      <div className="relative group">
                        <div
                          className="w-full bg-blue-500 hover:bg-blue-600 transition-colors rounded-t"
                          style={{
                            height: `${(hourData.newUsers / maxValue) * 40}%`,
                            minHeight: hourData.newUsers > 0 ? '2px' : '0'
                          }}
                          title={`新增用户: ${hourData.newUsers}`}
                        />
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          用户: {hourData.newUsers}
                        </div>
                      </div>

                      {/* 新信息柱状图 */}
                      <div className="relative group">
                        <div
                          className="w-full bg-green-500 hover:bg-green-600 transition-colors"
                          style={{
                            height: `${(hourData.newPosts / maxValue) * 30}%`,
                            minHeight: hourData.newPosts > 0 ? '2px' : '0'
                          }}
                          title={`新增信息: ${hourData.newPosts}`}
                        />
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          信息: {hourData.newPosts}
                        </div>
                      </div>

                      {/* 充值积分柱状图 */}
                      <div className="relative group">
                        <div
                          className="w-full bg-purple-500 hover:bg-purple-600 transition-colors"
                          style={{
                            height: `${(hourData.rechargePoints / 100 / maxValue) * 30}%`,
                            minHeight: hourData.rechargePoints > 0 ? '2px' : '0'
                          }}
                          title={`充值积分: ${hourData.rechargePoints}`}
                        />
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          积分: {hourData.rechargePoints}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 mt-2">{hourData.hour}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 图例 */}
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-gray-700">新增用户</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-gray-700">新增信息</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span className="text-gray-700">充值积分(÷100)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 详细数据表格 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">详细数据</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-4">时间</th>
                <th className="text-center py-2 px-4">新增用户</th>
                <th className="text-center py-2 px-4">新增信息</th>
                <th className="text-center py-2 px-4">充值积分</th>
                <th className="text-center py-2 px-4">活跃用户</th>
              </tr>
            </thead>
            <tbody>
              {data.map((hourData, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-4 font-medium">{hourData.hour}</td>
                  <td className="text-center py-2 px-4">
                    {hourData.newUsers > 0 ? (
                      <span className="text-blue-600 font-medium">{hourData.newUsers}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-center py-2 px-4">
                    {hourData.newPosts > 0 ? (
                      <span className="text-green-600 font-medium">{hourData.newPosts}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-center py-2 px-4">
                    {hourData.rechargePoints > 0 ? (
                      <span className="text-purple-600 font-medium">{hourData.rechargePoints}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-center py-2 px-4">
                    {hourData.activeUsers > 0 ? (
                      <span className="text-orange-600 font-medium">{hourData.activeUsers}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}