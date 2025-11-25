import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Eye, Calendar, Tag } from 'lucide-react'

export default function PostDetailPage() {
  const { id } = useParams()
  const [post, setPost] = useState<any>(null)
  const [postUser, setPostUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(false)
  const [wechatId, setWechatId] = useState('')
  const { user, setUser } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    loadPost()
  }, [id])

  const loadPost = async () => {
    try {
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (postError) throw postError
      if (!postData) {
        alert('信息不存在')
        navigate('/')
        return
      }

      setPost(postData)

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', postData.user_id)
        .maybeSingle()

      setPostUser(userData)

      // 检查是否已查看过
      if (user) {
        const { data: history } = await supabase
          .from('view_history')
          .select('*')
          .eq('user_id', user.id)
          .eq('post_id', id)
          .maybeSingle()

        if (history && userData) {
          setWechatId(userData.wechat_id)
        }
      }
    } catch (error) {
      console.error('加载失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewContact = async () => {
    if (!user || !post) return

    if (wechatId) {
      alert('联系方式已复制到剪贴板')
      navigator.clipboard.writeText(wechatId)
      return
    }

    if (user.points < 1) {
      alert('积分不足，请先充值')
      return
    }

    if (window.confirm('查看联系方式需要1积分，确认查看吗？')) {
      setViewing(true)
      try {
        const { data, error } = await supabase.functions.invoke('view-contact', {
          body: {
            user_id: user.id,
            post_id: post.id
          }
        })

        if (error) throw error

        if (data?.data?.wechat_id) {
          setWechatId(data.data.wechat_id)
          navigator.clipboard.writeText(data.data.wechat_id)
          alert('联系方式已复制到剪贴板：' + data.data.wechat_id)
          
          if (!data.data.already_viewed) {
            setUser({ ...user, points: user.points - 1 })
          }
        }
      } catch (error: any) {
        alert(error.message || '查看失败')
      } finally {
        setViewing(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!post) return null

  const tradeTypeMap: any = {
    1: { label: '求购', color: 'bg-green-100 text-green-700' },
    2: { label: '出售', color: 'bg-blue-100 text-blue-700' },
    3: { label: '做多', color: 'bg-red-100 text-red-700' },
    4: { label: '做空', color: 'bg-purple-100 text-purple-700' }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">交易详情</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex-1">{post.title}</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${tradeTypeMap[post.trade_type].color}`}>
              {tradeTypeMap[post.trade_type].label}
            </span>
          </div>

          <div className="text-3xl font-bold text-red-600 mb-6">¥{post.price}</div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Tag className="w-4 h-4" />
              <span>关键词：{post.keywords}</span>
            </div>

            {post.delivery_date && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>交割时间：{post.delivery_date}</span>
              </div>
            )}

            {post.extra_info && (
              <div className="text-gray-600">
                补充信息：{post.extra_info}
              </div>
            )}

            <div className="flex items-center gap-2 text-gray-600">
              <Eye className="w-4 h-4" />
              <span>查看次数：{post.view_count}/{post.view_limit}</span>
            </div>
          </div>
        </div>

        {postUser && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">发布者信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">成交率</span>
                <span className="font-medium">{postUser.deal_rate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">发布数量</span>
                <span className="font-medium">{postUser.total_posts}条</span>
              </div>
            </div>
          </div>
        )}

        {wechatId && (
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="font-semibold text-green-900 mb-2">联系方式</h3>
            <div className="flex items-center justify-between">
              <span className="text-lg font-mono">{wechatId}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(wechatId)
                  alert('已复制')
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
              >
                复制
              </button>
            </div>
          </div>
        )}
      </div>

      {!wechatId && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleViewContact}
              disabled={viewing}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {viewing ? '处理中...' : '查看联系方式（1积分）'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
