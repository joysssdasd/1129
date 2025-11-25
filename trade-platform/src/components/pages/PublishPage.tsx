import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { supabase } from '../../services/supabase'
import { ArrowLeft } from 'lucide-react'

export default function PublishPage() {
  const [title, setTitle] = useState('')
  const [keywords, setKeywords] = useState('')
  const [price, setPrice] = useState('')
  const [tradeType, setTradeType] = useState<number>(2)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [extraInfo, setExtraInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, setUser } = useUser()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    if (user.points < 10) {
      alert('积分不足，请先充值')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('publish-post', {
        body: {
          user_id: user.id,
          title,
          keywords,
          price: parseFloat(price),
          trade_type: tradeType,
          delivery_date: deliveryDate || null,
          extra_info: extraInfo || null
        }
      })

      if (error) throw error

      // 更新用户积分
      const updatedPoints = user.points - 10
      setUser({ ...user, points: updatedPoints, total_posts: user.total_posts + 1 })

      alert('发布成功！')
      navigate('/')
    } catch (error: any) {
      alert(error.message || '发布失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">发布交易信息</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                标题 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={30}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="请输入标题（不超过30字）"
                required
              />
              <div className="text-right text-sm text-gray-400 mt-1">
                {title.length}/30
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                关键词 *
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="请输入3-5个关键词，用英文逗号分隔"
                required
              />
              <div className="text-sm text-gray-500 mt-1">
                例如：演唱会,门票,转让
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                价格 *
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                step="0.01"
                min="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="请输入价格"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                交易类型 *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 1, label: '求购' },
                  { value: 2, label: '出售' },
                  { value: 3, label: '做多' },
                  { value: 4, label: '做空' }
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setTradeType(type.value)}
                    className={`py-2 rounded-lg border-2 transition-all ${
                      tradeType === type.value
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {(tradeType === 3 || tradeType === 4) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    交割时间 *
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    补充信息 *
                  </label>
                  <input
                    type="text"
                    value={extraInfo}
                    onChange={(e) => setExtraInfo(e.target.value)}
                    maxLength={20}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入补充信息（不超过20字）"
                    required
                  />
                </div>
              </>
            )}

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-800">发布费用</span>
                <span className="text-lg font-bold text-blue-600">10积分</span>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                当前积分：{user?.points} | 发布后可获得10次联系方式查看机会
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '发布中...' : '确认发布'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
