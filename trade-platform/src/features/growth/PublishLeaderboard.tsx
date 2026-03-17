import { useEffect, useState } from 'react'
import { Crown, Loader2, Medal, Trophy } from 'lucide-react'

import { fetchPublishLeaderboard, type PublishLeaderboardResponse } from '@/services/growthService'

interface PublishLeaderboardProps {
  userId?: string
  compact?: boolean
}

const rankIcons = {
  1: <Crown className="w-4 h-4 text-yellow-500" />,
  2: <Medal className="w-4 h-4 text-gray-500" />,
  3: <Medal className="w-4 h-4 text-orange-500" />,
}

export default function PublishLeaderboard({ userId, compact = false }: PublishLeaderboardProps) {
  const [mode, setMode] = useState<'7d' | 'all'>('7d')
  const [data, setData] = useState<PublishLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    fetchPublishLeaderboard(mode, userId)
      .then((result) => {
        if (active) {
          setData(result)
        }
      })
      .catch((error) => {
        console.error('Failed to load publish leaderboard:', error)
        if (active) {
          setData(null)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [mode, userId])

  const entries = compact ? data?.entries.slice(0, 5) || [] : data?.entries || []

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-gray-900">
            <Trophy className="w-5 h-5 text-orange-600" />
            <span className="font-semibold">{compact ? '发帖榜预览' : '发帖榜'}</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">{data?.windowLabel || '看看最近谁最活跃'}</div>
        </div>

        <div className="inline-flex rounded-full bg-gray-100 p-1">
          <button
            onClick={() => setMode('7d')}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              mode === '7d' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            近7天
          </button>
          <button
            onClick={() => setMode('all')}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              mode === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            总榜
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          榜单加载中...
        </div>
      )}

      {!loading && entries.length === 0 && <div className="text-sm text-gray-500 mt-4">暂时还没有榜单数据</div>}

      <div className="space-y-3 mt-4">
        {entries.map((entry) => (
          <div
            key={entry.userId}
            className={`rounded-2xl border px-4 py-3 flex items-center justify-between ${
              entry.isCurrentUser ? 'border-orange-300 bg-orange-50' : 'border-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700">
                {rankIcons[entry.rank as 1 | 2 | 3] || entry.rank}
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {entry.displayName}
                  {entry.isCurrentUser && <span className="ml-2 text-xs text-orange-600">我</span>}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {mode === '7d' ? `近7天发帖 ${entry.weeklyPosts} 条` : `累计发帖 ${entry.totalPosts} 条`}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {mode === '7d' ? entry.weeklyPosts : entry.totalPosts}
              </div>
              <div className="text-xs text-gray-500 mt-1">{entry.points} 积分</div>
            </div>
          </div>
        ))}
      </div>

      {!compact && data?.currentUserRank && (
        <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
          你的当前排名：第 {data.currentUserRank} 名
        </div>
      )}
    </div>
  )
}
