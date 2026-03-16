import { User } from '@/types'

type RewardUser = Pick<User, 'id' | 'points' | 'total_posts'>

interface RewardApiEnvelope<T> {
  success: boolean
  data?: T
  error?: {
    code?: string
    message?: string
  }
}

interface RegistrationBonusData {
  user: User
  pointsAdded: number
  targetPoints: number
  alreadyApplied?: boolean
}

interface DailyPublishRewardData {
  awarded: boolean
  alreadyRewarded?: boolean
  rewardPoints: number
  dailyRewardCount: number
  remainingDailyRewardSlots: number
  user: RewardUser
}

const postJson = async <T>(url: string, body: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as RewardApiEnvelope<T> | null

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error?.message || '奖励处理失败')
  }

  return payload.data
}

export const completeRegistrationBonus = async (userId: string) =>
  postJson<RegistrationBonusData>('/api/auth/registration-bonus', { userId })

export const claimDailyPublishReward = async (userId: string, postId: string) =>
  postJson<DailyPublishRewardData>('/api/posts/daily-publish-reward', { userId, postId })
