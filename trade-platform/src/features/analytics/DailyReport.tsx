import { useState, useEffect } from 'react'
import { Calendar, Download, FileText, Users, DollarSign, TrendingUp, RefreshCw, BarChart3 } from 'lucide-react'
import { supabase } from '../../services/supabase'

interface DailyStats {
  date: string
  newUsers: number
  newPosts: number
  rechargePoints: number
  activeUsers: number
  completedTransactions: number
  totalRevenue: number
}

interface DailyReport {
  date: string
  summary: {
    totalNewUsers: number
    totalNewPosts: number
    totalRechargePoints: number
    totalActiveUsers: number
    totalCompletedTransactions: number
    totalRevenue: number
    avgNewUsers: number
    avgNewPosts: number
    avgRechargePoints: number
    avgActiveUsers: number
    avgCompletedTransactions: number
    avgRevenue: number
  }
  dailyData: DailyStats[]
  trends: {
    usersTrend: number
    postsTrend: number
    rechargeTrend: number
    activityTrend: number
    transactionsTrend: number
    revenueTrend: number
  }
}

export default function DailyReport() {
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<'7days' | '30days' | '90days'>('7days')
  const [selectedDate, setSelectedDate] = useState<string>('')

  useEffect(() => {
    generateDailyReport()
  }, [dateRange])

  const generateDailyReport = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-report', {
        body: { dateRange }
      })

      if (error) throw error

      if (data?.data) {
        setReport(data.data)
      } else {
        // 降级到前端计算
        await calculateReportFrontend()
      }
    } catch (error) {
      console.error('生成日报失败:', error)
      await calculateReportFrontend()
    } finally {
      setLoading(false)
    }
  }

  const calculateReportFrontend = async () => {
    try {
      const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const startDateStr = startDate.toISOString()

      // 生成日期数组
      const dailyData: DailyStats[] = []
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]

        dailyData.push({
          date: dateStr,
          newUsers: 0,
          newPosts: 0,
          rechargePoints: 0,
          activeUsers: 0,
          completedTransactions: 0,
          totalRevenue: 0
        })
      }

      // 获取用户注册数据
      const { data: usersData } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', startDateStr)

      // 获取信息发布数据
      const { data: postsData } = await supabase
        .from('posts')
        .select('created_at, status')
        .gte('created_at', startDateStr)

      // 获取充值数据
      const { data: rechargeData } = await supabase
        .from('recharge_requests')
        .select('created_at, points, status, amount')
        .gte('created_at', startDateStr)

      // 获取用户活跃数据
      const { data: activityData } = await supabase
        .from('user_activity')
        .select('created_at, user_id')
        .gte('created_at', startDateStr)

      // 聚合到每日数据
      usersData?.forEach(user => {
        const dateStr = user.created_at.split('T')[0]
        const dayIndex = dailyData.findIndex(d => d.date === dateStr)
        if (dayIndex !== -1) {
          dailyData[dayIndex].newUsers++
        }
      })

      postsData?.forEach(post => {
        const dateStr = post.created_at.split('T')[0]
        const dayIndex = dailyData.findIndex(d => d.date === dateStr)
        if (dayIndex !== -1) {
          dailyData[dayIndex].newPosts++
          if (post.status === 2) {
            dailyData[dayIndex].completedTransactions++
          }
        }
      })

      rechargeData?.forEach(recharge => {
        const dateStr = recharge.created_at.split('T')[0]
        const dayIndex = dailyData.findIndex(d => d.date === dateStr)
        if (dayIndex !== -1 && recharge.status === 1) {
          dailyData[dayIndex].rechargePoints += recharge.points || 0
          dailyData[dayIndex].totalRevenue += recharge.amount || 0
        }
      })

      // 计算每日活跃用户数
      activityData?.forEach(activity => {
        const dateStr = activity.created_at.split('T')[0]
        const dayIndex = dailyData.findIndex(d => d.date === dateStr)
        if (dayIndex !== -1) {
          dailyData[dayIndex].activeUsers++
        }
      })

      // 计算汇总数据
      const summary = {
        totalNewUsers: dailyData.reduce((sum, d) => sum + d.newUsers, 0),
        totalNewPosts: dailyData.reduce((sum, d) => sum + d.newPosts, 0),
        totalRechargePoints: dailyData.reduce((sum, d) => sum + d.rechargePoints, 0),
        totalActiveUsers: dailyData.reduce((sum, d) => sum + d.activeUsers, 0),
        totalCompletedTransactions: dailyData.reduce((sum, d) => sum + d.completedTransactions, 0),
        totalRevenue: dailyData.reduce((sum, d) => sum + d.totalRevenue, 0),
        avgNewUsers: 0,
        avgNewPosts: 0,
        avgRechargePoints: 0,
        avgActiveUsers: 0,
        avgCompletedTransactions: 0,
        avgRevenue: 0
      }

      summary.avgNewUsers = summary.totalNewUsers / days
      summary.avgNewPosts = summary.totalNewPosts / days
      summary.avgRechargePoints = summary.totalRechargePoints / days
      summary.avgActiveUsers = summary.totalActiveUsers / days
      summary.avgCompletedTransactions = summary.totalCompletedTransactions / days
      summary.avgRevenue = summary.totalRevenue / days

      // 计算趋势（与前一个周期比较）
      const trends = {
        usersTrend: 0,
        postsTrend: 0,
        rechargeTrend: 0,
        activityTrend: 0,
        transactionsTrend: 0,
        revenueTrend: 0
      }

      if (dailyData.length >= days * 2) {
        const currentPeriod = dailyData.slice(-days)
        const previousPeriod = dailyData.slice(-days * 2, -days)

        trends.usersTrend = ((currentPeriod.reduce((sum, d) => sum + d.newUsers, 0) -
                              previousPeriod.reduce((sum, d) => sum + d.newUsers, 0)) /
                             previousPeriod.reduce((sum, d) => sum + d.newUsers, 0)) * 100

        trends.postsTrend = ((currentPeriod.reduce((sum, d) => sum + d.newPosts, 0) -
                              previousPeriod.reduce((sum, d) => sum + d.newPosts, 0)) /
                             previousPeriod.reduce((sum, d) => sum + d.newPosts, 0)) * 100

        trends.rechargeTrend = ((currentPeriod.reduce((sum, d) => sum + d.rechargePoints, 0) -
                                previousPeriod.reduce((sum, d) => sum + d.rechargePoints, 0)) /
                               previousPeriod.reduce((sum, d) => sum + d.rechargePoints, 0)) * 100

        trends.activityTrend = ((currentPeriod.reduce((sum, d) => sum + d.activeUsers, 0) -
                                previousPeriod.reduce((sum, d) => sum + d.activeUsers, 0)) /
                               previousPeriod.reduce((sum, d) => sum + d.activeUsers, 0)) * 100

        trends.transactionsTrend = ((currentPeriod.reduce((sum, d) => sum + d.completedTransactions, 0) -
                                    previousPeriod.reduce((sum, d) => sum + d.completedTransactions, 0)) /
                                   previousPeriod.reduce((sum, d) => sum + d.completedTransactions, 0)) * 100

        trends.revenueTrend = ((currentPeriod.reduce((sum, d) => sum + d.totalRevenue, 0) -
                               previousPeriod.reduce((sum, d) => sum + d.totalRevenue, 0)) /
                              previousPeriod.reduce((sum, d) => sum + d.totalRevenue, 0)) * 100
      }

      setReport({
        date: new Date().toISOString().split('T')[0],
        summary,
        dailyData,
        trends
      })
    } catch (error) {
      console.error('前端日报计算失败:', error)
      setReport(null)
    }
  }

  const exportToCSV = () => {
    if (!report) return

    const headers = ['日期', '新增用户', '新增信息', '充值积分', '活跃用户', '完成交易', '收入']
    const rows = report.dailyData.map(d => [
      d.date,
      d.newUsers.toString(),
      d.newPosts.toString(),
      d.rechargePoints.toString(),
      d.activeUsers.toString(),
      d.completedTransactions.toString(),
      d.totalRevenue.toFixed(2)
    ])

    const csvContent = [
      ['每日数据统计报告'],
      [`统计周期: ${dateRange === '7days' ? '最近7天' : dateRange === '30days' ? '最近30天' : '最近90天'}`],
      [`生成时间: ${new Date().toLocaleString()}`],
      [],
      ['汇总数据'],
      ['总新增用户', report.summary.totalNewUsers.toString()],
      ['总新增信息', report.summary.totalNewPosts.toString()],
      ['总充值积分', report.summary.totalRechargePoints.toString()],
      ['总活跃用户', report.summary.totalActiveUsers.toString()],
      ['总完成交易', report.summary.totalCompletedTransactions.toString()],
      ['总收入', `¥${report.summary.totalRevenue.toFixed(2)}`],
      [],
      headers,
      ...rows
    ].map(row => Array.isArray(row) ? row.join(',') : row).join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `每日统计报告_${report.date}.csv`
    link.click()
  }

  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />
    } else if (trend < 0) {
      return <TrendingUp className="w-4 h-4 text-red-500 transform rotate-180" />
    }
    return <div className="w-4 h-4 bg-gray-300 rounded-full" />
  }

  const selectedDayData = report?.dailyData.find(d => d.date === selectedDate)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">每日统计报告</h2>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7days' | '30days' | '90days')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="7days">最近7天</option>
            <option value="30days">最近30天</option>
            <option value="90days">最近90天</option>
          </select>
          <button
            onClick={generateDailyReport}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            <RefreshCw className="w-4 h-4" />
            生成报告
          </button>
          <button
            onClick={exportToCSV}
            disabled={!report}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300"
          >
            <Download className="w-4 h-4" />
            导出CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-2 text-gray-600">生成报告中...</span>
        </div>
      ) : report ? (
        <>
          {/* 汇总统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-blue-500" />
                {getTrendIcon(report.trends.usersTrend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">{report.summary.totalNewUsers}</div>
              <div className="text-sm text-gray-600">新增用户</div>
              <div className="text-xs text-gray-500">日均: {report.summary.avgNewUsers.toFixed(1)}</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-5 h-5 text-green-500" />
                {getTrendIcon(report.trends.postsTrend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">{report.summary.totalNewPosts}</div>
              <div className="text-sm text-gray-600">新增信息</div>
              <div className="text-xs text-gray-500">日均: {report.summary.avgNewPosts.toFixed(1)}</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-purple-500" />
                {getTrendIcon(report.trends.rechargeTrend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">{report.summary.totalRechargePoints}</div>
              <div className="text-sm text-gray-600">充值积分</div>
              <div className="text-xs text-gray-500">日均: {report.summary.avgRechargePoints.toFixed(0)}</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                {getTrendIcon(report.trends.activityTrend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">{report.summary.totalActiveUsers}</div>
              <div className="text-sm text-gray-600">活跃用户</div>
              <div className="text-xs text-gray-500">日均: {report.summary.avgActiveUsers.toFixed(1)}</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-red-500" />
                {getTrendIcon(report.trends.transactionsTrend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">{report.summary.totalCompletedTransactions}</div>
              <div className="text-sm text-gray-600">完成交易</div>
              <div className="text-xs text-gray-500">日均: {report.summary.avgCompletedTransactions.toFixed(1)}</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                {getTrendIcon(report.trends.revenueTrend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">¥{report.summary.totalRevenue.toFixed(0)}</div>
              <div className="text-sm text-gray-600">总收入</div>
              <div className="text-xs text-gray-500">日均: ¥{report.summary.avgRevenue.toFixed(0)}</div>
            </div>
          </div>

          {/* 日期选择和详细数据 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 日历/日期列表 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                选择日期
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {report.dailyData.map((dayData) => (
                  <button
                    key={dayData.date}
                    onClick={() => setSelectedDate(dayData.date)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedDate === dayData.date
                        ? 'bg-purple-100 border-purple-300'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{dayData.date}</span>
                      <div className="flex gap-2 text-xs">
                        {dayData.newUsers > 0 && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            用户: {dayData.newUsers}
                          </span>
                        )}
                        {dayData.newPosts > 0 && (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                            信息: {dayData.newPosts}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 选中日期的详细数据 */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">
                {selectedDayData ? `${selectedDayData.date} 详细数据` : '请选择日期查看详情'}
              </h3>

              {selectedDayData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-blue-600">新增用户</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-900">{selectedDayData.newUsers}</div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">新增信息</span>
                      </div>
                      <div className="text-2xl font-bold text-green-900">{selectedDayData.newPosts}</div>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-purple-500" />
                        <span className="text-sm text-purple-600">充值积分</span>
                      </div>
                      <div className="text-2xl font-bold text-purple-900">{selectedDayData.rechargePoints}</div>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-orange-500" />
                        <span className="text-sm text-orange-600">活跃用户</span>
                      </div>
                      <div className="text-2xl font-bold text-orange-900">{selectedDayData.activeUsers}</div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-600">完成交易</span>
                      </div>
                      <div className="text-2xl font-bold text-red-900">{selectedDayData.completedTransactions}</div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600">收入</span>
                      </div>
                      <div className="text-2xl font-bold text-green-900">¥{selectedDayData.totalRevenue.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* 趋势分析 */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">数据表现分析</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">用户新增表现:</span>
                        <span className={`ml-2 font-medium ${
                          selectedDayData.newUsers >= report.summary.avgNewUsers
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {selectedDayData.newUsers >= report.summary.avgNewUsers ? '高于' : '低于'}平均水平
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">信息发布表现:</span>
                        <span className={`ml-2 font-medium ${
                          selectedDayData.newPosts >= report.summary.avgNewPosts
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {selectedDayData.newPosts >= report.summary.avgNewPosts ? '高于' : '低于'}平均水平
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">充值积分表现:</span>
                        <span className={`ml-2 font-medium ${
                          selectedDayData.rechargePoints >= report.summary.avgRechargePoints
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {selectedDayData.rechargePoints >= report.summary.avgRechargePoints ? '高于' : '低于'}平均水平
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">用户活跃表现:</span>
                        <span className={`ml-2 font-medium ${
                          selectedDayData.activeUsers >= report.summary.avgActiveUsers
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {selectedDayData.activeUsers >= report.summary.avgActiveUsers ? '高于' : '低于'}平均水平
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>请选择左侧日期查看详细数据</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>暂无报告数据</p>
        </div>
      )}
    </div>
  )
}