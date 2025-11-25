/**
 * 老王我给你写用户端的AI批量发布组件！
 * 和管理员版本的区别：微信号自动使用用户自己的，不可选择
 */

import { useState } from 'react'
import { supabase } from '../../services/supabase'
import { Sparkles, ArrowRight, Check, X, Edit, Clock, AlertTriangle } from 'lucide-react'
import { useUser } from '../../contexts/UserContext'
import { TRADE_TYPE, POINTS, TIME, POST_STATUS } from '../../constants'

interface UserAIBatchPublishProps {
  userId: string
  userWechatId?: string
  onComplete?: () => void
  onViewPublished?: () => void
}

interface GeneratedPost {
  title: string
  keywords: string
  price: number
  description?: string
  trade_type: 'transfer' | 'request'
  delivery_time: string
}

export default function UserAIBatchPublish({
  userId,
  userWechatId,
  onComplete,
  onViewPublished
}: UserAIBatchPublishProps) {
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [postStatus, setPostStatus] = useState<string[]>([])
  const { user } = useUser()

  // 检查用户积分是否足够
  const canPublish = user?.points ? user.points >= POINTS.PUBLISH_POST_COST : false
  const remainingPosts = Math.floor((user?.points || 0) / POINTS.PUBLISH_POST_COST)

  const handleAIGenerate = async () => {
    if (!aiText.trim()) {
      alert('请输入要批量发布的商品描述')
      return
    }

    if (!canPublish) {
      alert(`积分不足！发布帖子需要 ${POINTS.PUBLISH_POST_COST} 积分，您当前只有 ${user?.points || 0} 积分`)
      return
    }

    setAiLoading(true)
    try {
      // 调用AI生成接口
      const { data, error } = await supabase.functions.invoke('ai-generate-posts', {
        body: {
          userText: aiText,
          userId: userId,
          isUser: true, // 标识是用户端发布
          userWechatId: userWechatId // 传递用户微信号
        }
      })

      if (error) {
        console.error('AI生成失败:', error)
        alert('AI生成失败，请重试')
        return
      }

      const posts = data?.posts || []

      // 限制生成数量，根据用户积分计算
      const maxPosts = Math.min(posts.length, remainingPosts)
      const limitedPosts = posts.slice(0, maxPosts)

      setGeneratedPosts(limitedPosts)
      setPostStatus(new Array(limitedPosts.length).fill('pending'))

      if (limitedPosts.length < posts.length) {
        alert(`AI生成了 ${posts.length} 个帖子，但根据您的积分只能发布 ${limitedPosts.length} 个`)
      }
    } catch (error) {
      console.error('AI生成失败:', error)
      alert('AI生成失败，请检查网络连接')
    } finally {
      setAiLoading(false)
    }
  }

  const handleEditPost = (index: number) => {
    setEditingIndex(index)
  }

  const handleSaveEdit = (index: number, field: keyof GeneratedPost, value: string | number) => {
    const updatedPosts = [...generatedPosts]
    updatedPosts[index] = {
      ...updatedPosts[index],
      [field]: field === 'price' ? Number(value) : value
    }
    setGeneratedPosts(updatedPosts)
  }

  const handleRemovePost = (index: number) => {
    const updatedPosts = generatedPosts.filter((_, i) => i !== index)
    const updatedStatus = postStatus.filter((_, i) => i !== index)
    setGeneratedPosts(updatedPosts)
    setPostStatus(updatedStatus)
  }

  const handleBatchPublish = async () => {
    if (generatedPosts.length === 0) {
      alert('没有要发布的帖子')
      return
    }

    const totalCost = generatedPosts.length * POINTS.PUBLISH_POST_COST
    if (totalCost > (user?.points || 0)) {
      alert(`积分不足！发布 ${generatedPosts.length} 个帖子需要 ${totalCost} 积分，您当前只有 ${user?.points || 0} 积分`)
      return
    }

    setAiLoading(true)
    try {
      const now = new Date().toISOString()
      const autoHideAt = new Date(Date.now() + TIME.POST_AUTO_HIDE).toISOString()

      // 使用RPC调用进行事务处理，确保发布和扣除积分的原子性
      const { data, error } = await supabase.functions.invoke('batch-publish-posts', {
        body: {
          userId: userId,
          posts: generatedPosts.map(post => ({
            user_id: userId,
            title: post.title,
            keywords: post.keywords,
            price: post.price,
            trade_type: post.trade_type,
            delivery_time: post.delivery_time,
            description: post.description,
            wechat_id: userWechatId,
            status: POST_STATUS.ACTIVE,
            view_count: 0,
            views_remaining: 100, // 默认可见次数
            created_at: now,
            updated_at: now,
            auto_hide_at: autoHideAt, // 使用常量，确保3天后自动下架
          })),
          totalCost: totalCost
        }
      })

      if (error) {
        console.error('批量发布失败:', error)
        alert(`发布失败: ${error.message}`)
        return
      }

      const { successCount, failedPosts } = data

      // 更新状态
      const newStatus = generatedPosts.map((_, index) => {
        if (failedPosts && failedPosts.includes(index)) {
          return 'error'
        }
        return index < successCount ? 'success' : 'pending'
      })
      setPostStatus(newStatus)

      if (successCount > 0) {
        alert(`成功发布 ${successCount} 个帖子！消耗 ${totalCost} 积分。所有帖子将在3天后自动下架。`)

        // 清空表单
        setGeneratedPosts([])
        setPostStatus([])
        setAiText('')

        // 更新用户积分状态（从返回的数据中获取最新积分）
        if (data.newPoints !== undefined) {
          // 这里可以更新用户上下文中的积分
        }

        onComplete?.()
        onViewPublished?.()
      } else {
        alert('发布失败，请检查网络连接或联系管理员')
      }
    } catch (error) {
      console.error('批量发布失败:', error)
      alert('批量发布失败，请重试')
    } finally {
      setAiLoading(false)
    }
  }

  const getRemainingTime = (createdHours: number) => {
    const totalHours = 72 // 3天 = 72小时
    const remaining = totalHours - createdHours
    if (remaining <= 0) return '已过期'
    if (remaining <= 12) return `${remaining}小时后过期`
    return `${Math.floor(remaining / 24)}天${remaining % 24}小时后过期`
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-500" />
          AI批量发布
        </h2>

        {/* 积分状态显示 */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">当前积分:</span>
            <span className="font-bold text-blue-600">{user?.points || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">可发布:</span>
            <span className="font-bold text-green-600">{remainingPosts}个</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">消耗:</span>
            <span className="font-bold text-red-600">{POINTS.PUBLISH_POST_COST}积分/个</span>
          </div>
        </div>
      </div>

      {/* 用户微信号显示 */}
      {userWechatId && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">
            <strong>联系方式:</strong> 将自动使用您的微信号 <span className="font-mono bg-white px-2 py-1 rounded">{userWechatId}</span>
          </p>
        </div>
      )}

      {/* 积分不足警告 */}
      {!canPublish && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700 font-medium">积分不足</p>
            <p className="text-xs text-red-600 mt-1">
              发布帖子需要 {POINTS.PUBLISH_POST_COST} 积分，您当前只有 {user?.points || 0} 积分。请先充值后再发布。
            </p>
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          描述您要批量发布的商品信息
        </label>
        <textarea
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          placeholder="请描述您要发布的商品，例如：我有一批苹果手机要转让，包括iPhone 13、14等型号，价格在3000-6000元之间..."
          className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          disabled={!canPublish}
        />
        <p className="text-xs text-gray-500 mt-1">
          AI将根据您的描述自动生成多个吸引人的商品标题和价格
        </p>
      </div>

      {/* 生成按钮 */}
      <div className="mb-6">
        <button
          onClick={handleAIGenerate}
          disabled={aiLoading || !aiText.trim() || !canPublish}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
        >
          <Sparkles className="w-5 h-5" />
          {aiLoading ? 'AI生成中...' : 'AI智能生成'}
        </button>
      </div>

      {/* 生成结果 */}
      {generatedPosts.length > 0 && (
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            AI为您生成了 {generatedPosts.length} 个商品信息
          </h3>

          {/* 过期时间提醒 */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-700 font-medium">⏰ 自动下架提醒</p>
              <p className="text-xs text-amber-600 mt-1">
                所有商品信息将在发布3天后自动下架，请确保及时处理交易
              </p>
            </div>
          </div>

          {generatedPosts.map((post, index) => (
            <div key={index} className="border rounded-lg p-4 bg-gray-50">
              {postStatus[index] === 'success' && (
                <div className="mb-2 p-2 bg-green-100 text-green-700 rounded text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  发布成功
                </div>
              )}
              {postStatus[index] === 'error' && (
                <div className="mb-2 p-2 bg-red-100 text-red-700 rounded text-sm flex items-center gap-2">
                  <X className="w-4 h-4" />
                  发布失败，请重试
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">商品标题</label>
                  {editingIndex === index ? (
                    <input
                      type="text"
                      value={post.title}
                      onChange={(e) => handleSaveEdit(index, 'title', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{post.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">价格 (元)</label>
                  {editingIndex === index ? (
                    <input
                      type="number"
                      value={post.price}
                      onChange={(e) => handleSaveEdit(index, 'price', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">¥{post.price}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">关键词</label>
                  {editingIndex === index ? (
                    <input
                      type="text"
                      value={post.keywords}
                      onChange={(e) => handleSaveEdit(index, 'keywords', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  ) : (
                    <p className="text-gray-900">{post.keywords}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">交易类型</label>
                  <p className="text-gray-900">
                    {post.trade_type === 'transfer' ? '转让' : '求购'}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  {editingIndex === index ? (
                    <textarea
                      value={post.description || ''}
                      onChange={(e) => handleSaveEdit(index, 'description', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded h-16 resize-none"
                    />
                  ) : (
                    <p className="text-gray-900">{post.description || '无描述'}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                {editingIndex === index ? (
                  <>
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="px-3 py-1 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      完成
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEditPost(index)}
                      className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:text-blue-800 transition-colors"
                      disabled={postStatus[index] !== 'pending'}
                    >
                      <Edit className="w-4 h-4" />
                      编辑
                    </button>
                    <button
                      onClick={() => handleRemovePost(index)}
                      className="flex items-center gap-1 px-3 py-1 text-red-600 hover:text-red-800 transition-colors"
                      disabled={postStatus[index] !== 'pending'}
                    >
                      <X className="w-4 h-4" />
                      删除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 批量发布按钮 */}
      {generatedPosts.length > 0 && (
        <div className="flex justify-between items-center pt-6 border-t">
          <div className="text-sm text-gray-600">
            共 {generatedPosts.length} 个商品，预计消耗 {generatedPosts.length * POINTS.PUBLISH_POST_COST} 积分
          </div>
          <div className="flex gap-3">
            <button
              onClick={onViewPublished}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              查看已发布
            </button>
            <button
              onClick={handleBatchPublish}
              disabled={aiLoading || generatedPosts.length === 0 || !canPublish}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              {aiLoading ? '发布中...' : `确认发布 (${generatedPosts.length}个)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}