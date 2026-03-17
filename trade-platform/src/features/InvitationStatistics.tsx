import { useEffect, useState } from 'react'
import { Gift, Loader2, Share2, Sparkles, Users } from 'lucide-react'

import type { User } from '@/types'
import { fetchGrowthDashboard, type GrowthDashboard } from '@/services/growthService'
import ShareModal from './ui/ShareModal'

interface InvitationStatisticsProps {
  user: User
}

export default function InvitationStatistics({ user }: InvitationStatisticsProps) {
  const [dashboard, setDashboard] = useState<GrowthDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)

    fetchGrowthDashboard(user.id)
      .then((data) => {
        if (active) {
          setDashboard(data)
        }
      })
      .catch((error) => {
        console.error('Failed to load invitation dashboard:', error)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [user.id])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-sm text-gray-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        邀请数据加载中...
      </div>
    )
  }

  if (!dashboard) {
    return <div className="bg-white rounded-2xl border border-gray-200 p-6 text-sm text-gray-500">邀请数据暂时不可用。</div>
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-3xl p-6 text-white bg-gradient-to-br from-violet-600 via-fuchsia-600 to-rose-500 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-white/80">邀请奖励页</div>
              <div className="text-2xl font-bold mt-1">分享邀请码，拉新也拉活跃</div>
              <div className="text-sm text-white/80 mt-2">
                邀请好友完成首发后，你得 +{dashboard.invitation.inviterRewardPoints}，好友得 +
                {dashboard.invitation.inviteeRewardPoints}
              </div>
            </div>
            <button
              onClick={() => setShowShareModal(true)}
              className="px-4 py-2 rounded-full bg-white text-violet-700 text-sm font-semibold hover:bg-violet-50"
            >
              立即分享
            </button>
          </div>

          <div className="mt-5 rounded-2xl bg-white/10 p-4">
            <div className="text-xs text-white/70">我的邀请码</div>
            <div className="text-3xl font-bold mt-2 tracking-widest">{dashboard.invitation.inviteCode}</div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(dashboard.invitation.inviteCode)
                  alert('邀请码已复制')
                }}
                className="px-3 py-2 rounded-full bg-white/15 text-sm hover:bg-white/20"
              >
                复制邀请码
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(dashboard.invitation.invitationLink)
                  alert('邀请链接已复制')
                }}
                className="px-3 py-2 rounded-full bg-white text-violet-700 text-sm font-medium"
              >
                复制邀请链接
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="w-4 h-4 text-sky-600" />
              累计邀请
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-3">{dashboard.invitation.totalInvites}</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              成功首发
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-3">{dashboard.invitation.successfulInvites}</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Share2 className="w-4 h-4 text-amber-600" />
              待转化
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-3">{dashboard.invitation.pendingInvites}</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Gift className="w-4 h-4 text-violet-600" />
              邀请奖励
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-3">{dashboard.invitation.totalPointsEarned}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="font-semibold text-gray-900">玩法说明</div>
          <div className="space-y-3 mt-4 text-sm text-gray-600">
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-semibold">
                1
              </div>
              <div>把邀请码或邀请链接发给潜在用户。</div>
            </div>
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-semibold">
                2
              </div>
              <div>好友注册后完成首发，你拿到邀请奖励，好友也拿到首发激励。</div>
            </div>
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-semibold">
                3
              </div>
              <div>成功邀请越多，站内活跃度越高，你的拉新积分也会越多。</div>
            </div>
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        invitationLink={dashboard.invitation.invitationLink}
        inviteCode={dashboard.invitation.inviteCode}
      />
    </>
  )
}
