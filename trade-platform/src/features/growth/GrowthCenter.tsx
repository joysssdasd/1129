import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, Gift, Loader2, Megaphone, Rocket, Share2, Sparkles, Trophy } from 'lucide-react'

import type { User } from '@/types'
import {
  claimDailyCheckIn,
  fetchGrowthDashboard,
  type GrowthDashboard,
} from '@/services/growthService'

interface GrowthCenterProps {
  user: User
  onUserChange?: (nextUser: User) => void
  onGoPublish: () => void
  onGoInvites: () => void
  onGoLeaderboard: () => void
}

export default function GrowthCenter({
  user,
  onUserChange,
  onGoPublish,
  onGoInvites,
  onGoLeaderboard,
}: GrowthCenterProps) {
  const [dashboard, setDashboard] = useState<GrowthDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkInLoading, setCheckInLoading] = useState(false)

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const data = await fetchGrowthDashboard(user.id)
      setDashboard(data)
    } catch (error) {
      console.error('Failed to load growth dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [user.id])

  const taskProgressText = useMemo(() => {
    if (!dashboard) return ''
    return `${dashboard.dailyPublish.rewardedCount}/${dashboard.dailyPublish.rewardLimit}`
  }, [dashboard])

  const handleCheckIn = async () => {
    if (checkInLoading || !dashboard || dashboard.checkIn.checkedInToday) return

    setCheckInLoading(true)
    try {
      const result = await claimDailyCheckIn(user.id)
      if (result.user && onUserChange) {
        onUserChange({
          ...user,
          points: result.user.points,
          total_posts: result.user.total_posts,
        })
      }
      await loadDashboard()
      alert(`签到成功，获得 ${result.rewardPoints} 积分`)
    } catch (error: any) {
      alert(error?.message || '签到失败，请稍后重试')
    } finally {
      setCheckInLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载活跃中心...
        </div>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 text-sm text-gray-500">
        活跃中心暂时不可用，请稍后重试。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl p-6 text-white bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/75">活跃中心</div>
            <div className="text-2xl font-bold mt-1">今日继续刷一波活跃度</div>
            <div className="text-sm text-white/80 mt-2">
              已连续签到 {dashboard.checkIn.streakDays} 天，今日发帖奖励进度 {taskProgressText}
            </div>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={dashboard.checkIn.checkedInToday || checkInLoading}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              dashboard.checkIn.checkedInToday
                ? 'bg-white/15 text-white/70 cursor-not-allowed'
                : 'bg-white text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {checkInLoading
              ? '签到中...'
              : dashboard.checkIn.checkedInToday
                ? '今日已签到'
                : `立即签到 +${dashboard.checkIn.rewardPoints}`}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-xs text-white/70">今日已发</div>
            <div className="text-2xl font-bold mt-1">{dashboard.dailyPublish.publishedTodayCount}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-xs text-white/70">已领奖励</div>
            <div className="text-2xl font-bold mt-1">{dashboard.dailyPublish.rewardedCount}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-xs text-white/70">剩余机会</div>
            <div className="text-2xl font-bold mt-1">{dashboard.dailyPublish.remainingRewardSlots}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dashboard.tasks.map((task) => {
          const progressPercent = task.target > 0 ? Math.min(100, (task.progress / task.target) * 100) : 100
          return (
            <div key={task.key} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      {task.key === 'daily_checkin' && <CalendarCheck2 className="w-4 h-4" />}
                      {task.key === 'daily_publish' && <Megaphone className="w-4 h-4" />}
                      {task.key === 'invite_reward' && <Share2 className="w-4 h-4" />}
                    </span>
                    <div className="font-semibold text-gray-900">{task.title}</div>
                  </div>
                  <div className="text-sm text-gray-500 mt-3">{task.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">奖励</div>
                  <div className="text-lg font-bold text-emerald-600">+{task.rewardPoints}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>{task.completed ? '已完成' : '进行中'}</span>
                  <span>
                    {task.progress}/{task.target}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={onGoPublish}
          className="rounded-2xl bg-white border border-gray-200 p-4 text-left hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
        >
          <Rocket className="w-5 h-5 text-emerald-600" />
          <div className="mt-3 font-semibold text-gray-900">去发帖</div>
          <div className="text-xs text-gray-500 mt-1">前 {dashboard.dailyPublish.rewardLimit} 条都能领奖励</div>
        </button>
        <button
          onClick={onGoLeaderboard}
          className="rounded-2xl bg-white border border-gray-200 p-4 text-left hover:border-orange-300 hover:bg-orange-50 transition-colors"
        >
          <Trophy className="w-5 h-5 text-orange-600" />
          <div className="mt-3 font-semibold text-gray-900">发帖榜</div>
          <div className="text-xs text-gray-500 mt-1">看看谁这周最活跃</div>
        </button>
        <button
          onClick={onGoInvites}
          className="rounded-2xl bg-white border border-gray-200 p-4 text-left hover:border-violet-300 hover:bg-violet-50 transition-colors"
        >
          <Sparkles className="w-5 h-5 text-violet-600" />
          <div className="mt-3 font-semibold text-gray-900">邀请奖励</div>
          <div className="text-xs text-gray-500 mt-1">邀请首发，你拿 +{dashboard.invitation.inviterRewardPoints}</div>
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">最近奖励动态</div>
            <div className="text-lg font-semibold text-gray-900 mt-1">积分到账记录</div>
          </div>
          <Gift className="w-5 h-5 text-emerald-600" />
        </div>

        <div className="space-y-3 mt-4">
          {dashboard.recentRewards.length === 0 && <div className="text-sm text-gray-500">今天还没有新的奖励记录</div>}
          {dashboard.recentRewards.map((item) => (
            <div key={item.id} className="flex items-center justify-between border border-gray-100 rounded-2xl px-4 py-3">
              <div>
                <div className="font-medium text-gray-900">{item.description}</div>
                <div className="text-xs text-gray-500 mt-1">{new Date(item.createdAt).toLocaleString()}</div>
              </div>
              <div className="text-emerald-600 font-semibold">+{item.changeAmount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
