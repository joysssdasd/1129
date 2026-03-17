import { User } from '@/types'

export interface GrowthSettings {
  registrationPoints: number
  dailyPostReward: number
  dailyPostRewardLimit: number
  dailyCheckinReward: number
  inviterRewardPoints: number
  inviteeRewardPoints: number
}

export interface GrowthTask {
  key: string
  title: string
  description: string
  rewardPoints: number
  completed: boolean
  progress: number
  target: number
  actionLabel: string
}

export interface GrowthRewardActivity {
  id: string
  changeType: number
  changeAmount: number
  description: string
  createdAt: string
}

export interface GrowthDashboard {
  user: Pick<User, 'id' | 'points' | 'total_posts' | 'invite_code'>
  settings: GrowthSettings
  checkIn: {
    checkedInToday: boolean
    rewardPoints: number
    streakDays: number
    checkedInAt?: string | null
  }
  dailyPublish: {
    publishedTodayCount: number
    rewardedCount: number
    rewardLimit: number
    rewardPoints: number
    remainingRewardSlots: number
  }
  invitation: {
    inviteCode: string
    invitationLink: string
    totalInvites: number
    successfulInvites: number
    pendingInvites: number
    totalPointsEarned: number
    inviterRewardPoints: number
    inviteeRewardPoints: number
  }
  tasks: GrowthTask[]
  recentRewards: GrowthRewardActivity[]
}

export interface PublishLeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  weeklyPosts: number
  totalPosts: number
  points: number
  isCurrentUser?: boolean
}

export interface PublishLeaderboardResponse {
  window: '7d' | 'all'
  windowLabel: string
  entries: PublishLeaderboardEntry[]
  currentUserRank?: number | null
}

export interface AdminGrowthSetting {
  key: string
  label: string
  description: string
  value: number
  min: number
  max: number
}

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
  user: Pick<User, 'id' | 'points' | 'total_posts'>
}

interface DailyCheckInData {
  awarded: boolean
  rewardPoints: number
  alreadyCheckedIn?: boolean
  streakDays: number
  checkedInAt?: string
  user: Pick<User, 'id' | 'points' | 'total_posts'>
}

const DEFAULT_GROWTH_SETTINGS: GrowthSettings = {
  registrationPoints: 500,
  dailyPostReward: 10,
  dailyPostRewardLimit: 5,
  dailyCheckinReward: 5,
  inviterRewardPoints: 10,
  inviteeRewardPoints: 30,
}

let growthSettingsCache: GrowthSettings | null = null
let growthSettingsPromise: Promise<GrowthSettings> | null = null

const parseJsonResponse = async <T>(response: Response) => {
  const payload = (await response.json().catch(() => null)) as RewardApiEnvelope<T> | null

  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(payload?.error?.message || '请求失败')
  }

  return payload.data
}

const postJson = async <T>(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })

  return parseJsonResponse<T>(response)
}

const patchJson = async <T>(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) => {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })

  return parseJsonResponse<T>(response)
}

const getJson = async <T>(url: string, headers: Record<string, string> = {}) => {
  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  return parseJsonResponse<T>(response)
}

export const getDefaultGrowthSettings = () => DEFAULT_GROWTH_SETTINGS

export const fetchGrowthSettings = async (force = false): Promise<GrowthSettings> => {
  if (!force && growthSettingsCache) return growthSettingsCache
  if (!force && growthSettingsPromise) return growthSettingsPromise

  growthSettingsPromise = getJson<{ settings: GrowthSettings }>('/api/growth/config')
    .then((data) => {
      growthSettingsCache = data.settings || DEFAULT_GROWTH_SETTINGS
      return growthSettingsCache
    })
    .catch(() => {
      growthSettingsCache = DEFAULT_GROWTH_SETTINGS
      return growthSettingsCache
    })
    .finally(() => {
      growthSettingsPromise = null
    })

  return growthSettingsPromise
}

export const completeRegistrationBonus = async (userId: string) =>
  postJson<RegistrationBonusData>('/api/auth/registration-bonus', { userId })

export const claimDailyPublishReward = async (userId: string, postId: string) =>
  postJson<DailyPublishRewardData>('/api/posts/daily-publish-reward', { userId, postId })

export const claimDailyCheckIn = async (userId: string) =>
  postJson<DailyCheckInData>('/api/growth/check-in', { userId })

export const fetchGrowthDashboard = async (userId: string) =>
  getJson<GrowthDashboard>(`/api/growth/dashboard?userId=${encodeURIComponent(userId)}`)

export const fetchPublishLeaderboard = async (window: '7d' | 'all' = '7d', userId?: string) => {
  const search = new URLSearchParams({ window })
  if (userId) {
    search.set('userId', userId)
  }

  return getJson<PublishLeaderboardResponse>(`/api/growth/leaderboard?${search.toString()}`)
}

export const fetchAdminGrowthSettings = async (adminUserId: string) =>
  getJson<{ settings: AdminGrowthSetting[] }>('/api/admin/growth-settings', {
    'x-admin-user-id': adminUserId,
  })

export const updateAdminGrowthSetting = async (adminUserId: string, key: string, value: number) =>
  patchJson<{ setting: AdminGrowthSetting }>(
    `/api/admin/growth-settings/${encodeURIComponent(key)}`,
    { value },
    { 'x-admin-user-id': adminUserId }
  )
