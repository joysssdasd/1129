import { useState } from 'react'
import { supabase } from '../../services/supabase'
import { Sparkles, ArrowRight, Check, X, Edit } from 'lucide-react'

interface AIBatchPublishProps {
  userId: string
  onComplete?: () => void
  onViewPublished?: () => void
}

export default function AIBatchPublish({ userId, onComplete, onViewPublished }: AIBatchPublishProps) {
  const [step, setStep] = useState(1)
  const [tradeType, setTradeType] = useState<number>(2)
  const [wechatId, setWechatId] = useState('')
  const [textInput, setTextInput] = useState('')
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [publishResult, setPublishResult] = useState<any>(null)

  const handleParse = async () => {
    if (!textInput.trim()) {
      alert('请输入交易描述文本')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-batch-publish-v2', {
        body: {
          user_id: userId,
          text_input: textInput,
          trade_type: tradeType,
          wechat_id: wechatId,
          step: 'parse'
        }
      })

      if (error) throw error

      if (data?.data?.drafts) {
        setDrafts(data.data.drafts)
        setStep(2)
      } else {
        alert('未能解析出有效信息，请检查文本格式')
      }
    } catch (error: any) {
      alert(error.message || 'AI解析失败')
    } finally {
      setLoading(false)
    }
  }

  const handleEditDraft = (index: number, field: string, value: any) => {
    const newDrafts = [...drafts]
    newDrafts[index][field] = value
    setDrafts(newDrafts)
  }

  const handleRemoveDraft = (index: number) => {
    setDrafts(drafts.filter((_, i) => i !== index))
  }

  const handlePublish = async () => {
    if (drafts.length === 0) {
      alert('没有可发布的草稿')
      return
    }

    if (!window.confirm(`确定要发布${drafts.length}条信息吗？`)) {
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-batch-publish-v2', {
        body: {
          user_id: userId,
          drafts: drafts,
          step: 'publish'
        }
      })

      if (error) throw error

      setPublishResult(data?.data)
      setStep(3)
      if (onComplete) onComplete()
    } catch (error: any) {
      alert(error.message || '发布失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep(1)
    setTextInput('')
    setDrafts([])
    setPublishResult(null)
  }

  const handleViewPublished = () => {
    // 触发查看发布信息的回调（会切换到信息管理标签）
    if (onViewPublished) onViewPublished()
  }

  return (
    <div className="bg-white rounded-lg p-6">
      {/* 步骤指示器 */}
      <div className="mb-6">
        <div className="flex items-center justify-center mb-4">
          <div className={`flex items-center ${step >= 1 ? 'text-purple-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}>
              {step > 1 ? <Check className="w-5 h-5" /> : '1'}
            </div>
            <span className="ml-2 text-sm font-medium">配置</span>
          </div>
          <div className={`w-16 h-1 mx-2 ${step >= 2 ? 'bg-purple-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center ${step >= 2 ? 'text-purple-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}>
              {step > 2 ? <Check className="w-5 h-5" /> : '2'}
            </div>
            <span className="ml-2 text-sm font-medium">审核</span>
          </div>
          <div className={`w-16 h-1 mx-2 ${step >= 3 ? 'bg-purple-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center ${step >= 3 ? 'text-purple-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}>
              {step >= 3 ? <Check className="w-5 h-5" /> : '3'}
            </div>
            <span className="ml-2 text-sm font-medium">完成</span>
          </div>
        </div>
      </div>

      {/* 步骤1: 配置 */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg mb-4">第一步：选择配置</h3>
          
          <div>
            <label className="block text-sm font-medium mb-2">交易类型</label>
            <div className="flex gap-4">
              <button
                onClick={() => setTradeType(1)}
                className={`flex-1 py-3 rounded-lg border-2 ${tradeType === 1 ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-300'}`}
              >
                买入
              </button>
              <button
                onClick={() => setTradeType(2)}
                className={`flex-1 py-3 rounded-lg border-2 ${tradeType === 2 ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-300'}`}
              >
                卖出
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">微信号（选填）</label>
            <input
              type="text"
              value={wechatId}
              onChange={(e) => setWechatId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="留空则使用账号默认微信号"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">交易描述文本</label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              rows={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="例如：成都周深 2 号邀请函代录 399的900 699的1000 包厢的1150 929的1250"
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              AI将自动解析文本中的交易信息，生成标题、价格、关键词等字段。请确保文本格式清晰。
            </p>
          </div>

          <button
            onClick={handleParse}
            disabled={loading || !textInput.trim()}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? '解析中...' : (
              <>
                <Sparkles className="w-5 h-5" />
                AI解析并生成草稿
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}

      {/* 步骤2: 审核草稿 */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">第二步：审核草稿（共{drafts.length}条）</h3>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              返回上一步
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {drafts.map((draft, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm font-medium text-gray-600">草稿 {index + 1}</span>
                  <button
                    onClick={() => handleRemoveDraft(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">标题</label>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => handleEditDraft(index, 'title', e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">价格</label>
                      <input
                        type="number"
                        value={draft.price}
                        onChange={(e) => handleEditDraft(index, 'price', parseFloat(e.target.value))}
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">类型</label>
                      <select
                        value={draft.trade_type}
                        onChange={(e) => handleEditDraft(index, 'trade_type', parseInt(e.target.value))}
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value={1}>买入</option>
                        <option value={2}>卖出</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">描述</label>
                    <textarea
                      value={draft.description || ''}
                      onChange={(e) => handleEditDraft(index, 'description', e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handlePublish}
            disabled={loading || drafts.length === 0}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? '发布中...' : `批量发布（${drafts.length}条）`}
          </button>
        </div>
      )}

      {/* 步骤3: 完成 */}
      {step === 3 && publishResult && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          
          <h3 className="font-semibold text-lg">发布完成</h3>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {publishResult.success_count} / {publishResult.total_count}
            </div>
            <div className="text-sm text-gray-600">
              成功发布{publishResult.success_count}条，共{publishResult.total_count}条
            </div>
          </div>

          {publishResult.errors && publishResult.errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-4 text-left">
              <p className="text-sm font-medium text-red-800 mb-2">失败列表：</p>
              <ul className="text-sm text-red-700 space-y-1">
                {publishResult.errors.map((err: any, idx: number) => (
                  <li key={idx}>• {err.title}: {err.error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              继续批量发布
            </button>
            <button
              onClick={handleViewPublished}
              className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
            >
              查看发布的信息
            </button>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-800">
              💡 提示：发布成功的信息已自动上架，可在"信息管理"标签中查看和管理。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
