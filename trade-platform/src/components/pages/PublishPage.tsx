import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { supabase } from '../../services/supabase'
import { ArrowLeft } from 'lucide-react'

export default function PublishPage() {
  const [title, setTitle] = useState('')
  const [keywords, setKeywords] = useState('')
  const [price, setPrice] = useState('')
  const [tradeType, setTradeType] = useState<number>(2)
  const [deliveryDays, setDeliveryDays] = useState<string>('7')
  const [extraInfo, setExtraInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [bannedKeywords, setBannedKeywords] = useState<string[]>([])
  const { user, setUser } = useUser()
  const navigate = useNavigate()

  // 加载敏感词库
  useEffect(() => {
    loadBannedKeywords()
  }, [])

  const loadBannedKeywords = async () => {
    const { data } = await supabase
      .from('banned_keywords')
      .select('keyword')
    if (data) {
      setBannedKeywords(data.map(item => item.keyword))
    }
  }

  // 检查敏感词
  const checkSensitiveWords = (text: string): string | null => {
    const lowerText = text.toLowerCase()
    for (const keyword of bannedKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return keyword
      }
    }
    return null
  }

  // 标题建议数据（可以根据实际情况扩展）
  const commonTitlePatterns = [
    '演唱会', '音乐会', '音乐节', '话剧', '舞台剧',
    '门票', '票', '邀请函', '代录', '转让',
    '周杰伦', '林俊杰', '五月天', '陈奕迅', '邓紫棋',
    '成都', '北京', '上海', '广州', '深圳', '杭州',
    '体育馆', '体育中心', '大剧院', '音乐厅',
    '看台', '内场', 'VIP', '包厢', '前排',
    'iPhone 15', 'iPhone 16', '华为Mate', '小米', '三星',
    'PS5', 'Xbox', 'Switch', '显卡', 'CPU', '内存',
    '红色', '蓝色', '黑色', '白色', '粉色', '金色',
    '全新', '9成新', '95新', '拆封未用', '仅激活'
  ]

  // 标题输入处理和自动补全
  const handleTitleChange = (value: string) => {
    setTitle(value)

    if (value.length > 0) {
      // 根据输入内容过滤建议
      const filtered = commonTitlePatterns.filter(pattern =>
        pattern.toLowerCase().includes(value.toLowerCase())
      )
      setTitleSuggestions(filtered.slice(0, 8)) // 限制显示8个建议
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  // 选择建议
  const handleSelectSuggestion = (suggestion: string) => {
    // 在现有标题基础上添加建议，避免覆盖
    const newTitle = title.includes(suggestion) ? title : `${title} ${suggestion}`.trim()
    setTitle(newTitle)
    setShowSuggestions(false)
  }

  // 点击外部关闭建议
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    if (user.points < 10) {
      alert('积分不足，请先充值')
      return
    }

    // 敏感词检查
    const allText = `${title} ${extraInfo} ${keywords}`
    const foundKeyword = checkSensitiveWords(allText)
    if (foundKeyword) {
      alert(`发布内容包含违规词汇"${foundKeyword}"，请删除后重新提交`)
      return
    }

    setLoading(true)
    
    // 乐观更新：先更新本地状态，提升用户体验
    const updatedPoints = user.points - 10
    setUser({ ...user, points: updatedPoints, total_posts: user.total_posts + 1 })
    
    try {
      const { data, error } = await supabase.functions.invoke('publish-post', {
        body: {
          user_id: user.id,
          title,
          keywords,
          price: parseFloat(price),
          trade_type: tradeType,
          delivery_days: (tradeType === 3 || tradeType === 4) ? parseInt(deliveryDays) : null,
          extra_info: extraInfo || null
        }
      })

      if (error) throw error

      alert('发布成功！')
      navigate('/')
    } catch (error: any) {
      // 发布失败，回滚本地状态
      setUser({ ...user, points: user.points, total_posts: user.total_posts })
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
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                标题 *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onFocus={() => title.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  maxLength={30}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="请将商品关键字标出，例如歌手，城市，日期，票档，产品型号颜色等"
                  required
                />
                {showSuggestions && titleSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {titleSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right text-sm text-gray-400 mt-1">
                {title.length}/30
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                补充信息
              </label>
              <textarea
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value)}
                maxLength={30}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="请勿填写任何联系方式，主要是对商品信息交易方式的补充"
              />
              <div className="text-right text-sm text-gray-400 mt-1">
                {extraInfo.length}/30
              </div>
              <div className="text-sm text-gray-500 mt-1">
                非必填项，请勿填写联系方式
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  交割期限 *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                    min="1"
                    max="365"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入天数"
                    required
                  />
                  <span className="text-gray-600 font-medium">天</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  请输入1-365之间的天数
                </div>
              </div>
            )}

            {/* 做多/做空风险提示 */}
            {(tradeType === 3 || tradeType === 4) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-medium mb-2">⚠️ 风险提示</p>
                <ul className="text-xs text-red-600 space-y-1">
                  <li>• 市场有风险，投资决策需谨慎</li>
                  <li>• 本信息仅代表个人看法，仅供参考</li>
                  <li>• 请勿使用"保本""稳赚"等承诺性词汇</li>
                </ul>
              </div>
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
