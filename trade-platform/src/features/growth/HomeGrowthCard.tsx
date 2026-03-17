import { useEffect, useState } from 'react'
import { CalendarCheck2, Loader2, Megaphone, Sparkles, Trophy } from 'lucide-react'

import type { User } from '@/types'
import { claimDailyCheckIn, fetchGrowthDashboard, fetchGrowthSettings, type GrowthDashboard, type GrowthSettings } from '@/services/growthService'

interface HomeGrowthCardProps {
  user: User | null
  onUserChange?: (nextUser: User) => void
  onGoLogin: () => void
  onGoPublish: () => void
  onGoGrowth: () => void
  onGoLeaderboard: () => void
}

export default function HomeGrowthCard({
  user,
  onUserChange,
  onGoLogin,
  onGoPublish,
  onGoGrowth,
  onGoLeaderboard,
}: HomeGrowthCardProps) {
  const [settings, setSettings] = useState<GrowthSettings | null>(null)
  const [dashboard, setDashboard] = useState<GrowthDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkInLoading, setCheckInLoading] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      try {
        const config = await fetchGrowthSettings()
        if (!active) return
        setSettings(config)

        if (user?.id) {
          const data = await fetchGrowthDashboard(user.id)
          if (active) {
            setDashboard(data)
          }
        } else if (active) {
          setDashboard(null)
        }
      } catch (error) {
        console.error('Failed to load home growth card:', error)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [user?.id])

  const handleCheckIn = async () => {
    if (!user) {
      onGoLogin()
      return
    }
    if (!dashboard || dashboard.checkIn.checkedInToday || checkInLoading) return

    setCheckInLoading(true)
    try {
      const result = await claimDailyCheckIn(user.id)
      if (onUserChange) {
        onUserChange({
          ...user,
          points: result.user.points,
          total_posts: result.user.total_posts,
        })
      }
      const nextDashboard = await fetchGrowthDashboard(user.id)
      setDashboard(nextDashboard)
    } catch (error: any) {
      alert(error?.message || '签到失败，请稍后再试')
    } finally {
      setCheckInLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          活跃中心加载中...
        </div>
      </div>
    )
  }

  const activeSettings = settings || {
    registrationPoints: 500,
    dailyPostReward: 10,
    dailyPostRewardLimit: 5,
    dailyCheckinReward: 5,
    inviterRewardPoints: 10,
    inviteeRewardPoints: 30,
  }

  return (
    <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-emerald-700 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            活跃中心
          </div>
          <div className="mt-3 text-xl font-bold text-gray-900">
            {user ? '签到、发帖、邀请，都能拉高站内活跃' : '注册就送积分，来站里做第一批高活跃用户'}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            注册补齐到 {activeSettings.registrationPoints} 分，每日前 {activeSettings.dailyPostRewardLimit} 条发帖每条奖励{' '}
            {activeSettings.dailyPostReward} 分，签到再拿 {activeSettings.dailyCheckinReward} 分。
          </div>
        </div>

        <button
          onClick={user ? handleCheckIn : onGoLogin}
          disabled={checkInLoading || Boolean(dashboard?.checkIn.checkedInToday)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            dashboard?.checkIn.checkedInToday
              ? 'bg-white text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {checkInLoading ? '签到中...' : dashboard?.checkIn.checkedInToday ? '今日已签到' : `签到 +${activeSettings.dailyCheckinReward}`}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
        <button
          onClick={user ? onGoGrowth : onGoLogin}
          className="rounded-2xl bg-white/80 border border-white p-4 text-left hover:border-emerald-200 transition-colors"
        >
          <CalendarCheck2 className="w-5 h-5 text-emerald-600" />
          <div className="mt-3 font-semibold text-gray-900">签到任务</div>
          <div className="text-xs text-gray-500 mt-1">
            {dashboard ? `连续签到 ${dashboard.checkIn.streakDays} 天` : '每日都能领积分'}
          </div>
        </button>
        <button
          onClick={user ? onGoPublish : onGoLogin}
          className="rounded-2xl bg-white/80 border border-white p-4 text-left hover:border-teal-200 transition-colors"
        >
          <Megaphone className="w-5 h-5 text-teal-600" />
          <div className="mt-3 font-semibold text-gray-900">发帖奖励</div>
          <div className="text-xs text-gray-500 mt-1">
            {dashboard
              ? `今日已领奖励 ${dashboard.dailyPublish.rewardedCount}/${dashboard.dailyPublish.rewardLimit}`
              : `前 ${activeSettings.dailyPostRewardLimit} 条发帖可领奖励`}
          </div>
        </button>
        <button
          onClick={onGoLeaderboard}
          className="rounded-2xl bg-white/80 border border-white p-4 text-left hover:border-orange-200 transition-colors"
        >
          <Trophy className="w-5 h-5 text-orange-600" />
          <div className="mt-3 font-semibold text-gray-900">发帖榜</div>
          <div className="text-xs text-gray-500 mt-1">看看这周谁在带动市场活跃度</div>
        </button>
      </div>
    </div>
  )
}
