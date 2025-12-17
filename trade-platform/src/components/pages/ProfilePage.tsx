import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { supabase } from '../../services/supabase'
import { ArrowLeft, Copy, Upload, MessageCircle, Receipt, TrendingUp, FileText, Edit, Trash2, Clock, CheckCircle, XCircle, Key, Users, Sparkles, Archive, AlertTriangle, Megaphone, X } from 'lucide-react'
import InvitationStatistics from '../../features/InvitationStatistics'
import UserAIBatchPublish from '../../features/forms/UserAIBatchPublish'
import { autoHideService } from '../../services/autoHideService'
import { POST_STATUS } from '../../constants'
import { log } from '../../utils/logger'

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [myPosts, setMyPosts] = useState<any[]>([])
  const [expiredPosts, setExpiredPosts] = useState<any[]>([])
  const [viewHistory, setViewHistory] = useState<any[]>([])
  const [pointTransactions, setPointTransactions] = useState<any[]>([])
  const [rechargeRecords, setRechargeRecords] = useState<any[]>([])
  const [rechargeAmount, setRechargeAmount] = useState<number>(50)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [isCustomRecharge, setIsCustomRecharge] = useState<boolean>(false)
  const [screenshot, setScreenshot] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [paymentQRCodes, setPaymentQRCodes] = useState<{wechat?: string, alipay?: string}>({})

  // 修改密码相关
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // 公告和客服设置
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; content: string }[]>([])
  const [closedAnnouncements, setClosedAnnouncements] = useState<string[]>([])
  const [serviceSettings, setServiceSettings] = useState<{ [key: string]: string }>({})

  const { user, setUser } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (activeTab === 'posts') loadMyPosts()
    if (activeTab === 'expired') loadExpiredPosts()
    if (activeTab === 'history') loadViewHistory()
    if (activeTab === 'points') loadPointTransactions()
    if (activeTab === 'rechargeHistory') loadRechargeRecords()
    if (activeTab === 'recharge') loadPaymentQRCodes()
    if (activeTab === 'service') loadServiceSettings()
  }, [activeTab])

  // 初始加载公告和刷新用户数据
  useEffect(() => {
    loadAnnouncements()
    refreshUserData()
    // 加载已关闭的公告列表
    const closed = localStorage.getItem('closedAnnouncements')
    if (closed) {
      setClosedAnnouncements(JSON.parse(closed))
    }
  }, [])

  // 刷新用户数据，确保积分等信息是最新的
  const refreshUserData = async () => {
    if (!user?.id) return
    try {
      const { data: updatedUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (updatedUser) {
        setUser(updatedUser)
      }
    } catch (error) {
      log.error('刷新用户数据失败:', error)
    }
  }

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, content')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(3)
    setAnnouncements(data || [])
  }

  // 关闭公告
  const handleCloseAnnouncement = (announcementId: string) => {
    const newClosed = [...closedAnnouncements, announcementId]
    setClosedAnnouncements(newClosed)
    localStorage.setItem('closedAnnouncements', JSON.stringify(newClosed))
  }

  // 过滤已关闭的公告
  const visibleAnnouncements = announcements.filter(ann => !closedAnnouncements.includes(ann.id))

  const loadServiceSettings = async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'service')
    
    const settings: { [key: string]: string } = {}
    data?.forEach(s => { settings[s.key] = s.value })
    setServiceSettings(settings)
  }

  const loadPaymentQRCodes = async () => {
    try {
      // 临时解决方案：直接从Supabase获取二维码数据
      const { data, error } = await supabase
        .from('payment_qrcodes')
        .select('payment_type, qr_code_url')
        .eq('status', 'active') // 只获取激活的二维码
        .order('created_at', { ascending: false })

      if (error) {
        log.error('获取收款二维码失败：', error)
        return
      }

      const wechat = data?.find((q: any) => q.payment_type === 'wechat')
      const alipay = data?.find((q: any) => q.payment_type === 'alipay')

      setPaymentQRCodes({
        wechat: wechat?.qr_code_url,
        alipay: alipay?.qr_code_url
      })
    } catch (error) {
      log.error('获取收款二维码失败：', error)
    }
  }

  const loadMyPosts = async () => {
    if (!user) return
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setMyPosts(data || [])
  }

  const loadExpiredPosts = async () => {
    if (!user) return
    try {
      const expiredPosts = await autoHideService.getUserExpiredPosts(user.id)
      setExpiredPosts(expiredPosts)
    } catch (error) {
      log.error('加载过期帖子失败:', error)
      setExpiredPosts([])
    }
  }

  const loadViewHistory = async () => {
    if (!user) return
    const { data } = await supabase
      .from('view_history')
      .select('*, posts(*)')
      .eq('user_id', user.id)
      .order('viewed_at', { ascending: false })
    setViewHistory(data || [])
  }

  const loadPointTransactions = async () => {
    if (!user) return
    const { data } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setPointTransactions(data || [])
  }

  const loadRechargeRecords = async () => {
    if (!user) return
    const { data } = await supabase
      .from('recharge_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setRechargeRecords(data || [])
  }

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('确定要删除这条发布吗？删除后将无法恢复。')) return
    
    setLoading(true)
    try {
      // 先获取用户信息更新
      const { data: userData } = await supabase
        .from('users')
        .select('total_posts')
        .eq('id', user?.id)
        .single()

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user?.id)
      
      if (error) {
        log.error('删除错误：', error)
        throw error
      }
      
      // 更新用户发布数
      if (userData && userData.total_posts > 0) {
        await supabase
          .from('users')
          .update({ total_posts: userData.total_posts - 1 })
          .eq('id', user?.id)
      }
      
      alert('删除成功')
      
      // 重新加载用户数据和发布列表
      const { data: updatedUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single()
      
      if (updatedUser) setUser(updatedUser)
      loadMyPosts()
    } catch (error: any) {
      log.error('删除失败：', error)
      alert(error.message || '删除失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePostStatus = async (postId: string, currentStatus: number, viewCount: number, viewLimit: number) => {
    log.log('🔴 按钮被点击', { postId, currentStatus, viewCount, viewLimit })
    
    // 如果是下架操作，提前计算并显示将返还的积分
    if (currentStatus === 1) {
      const remainingViews = viewLimit - viewCount;
      const confirmMessage = remainingViews > 0 
        ? `确定要下架吗？将返还${remainingViews}积分`
        : '确定要下架吗？';
      
      if (!window.confirm(confirmMessage)) return;
    }
    // 如果是上架操作，显示将扣除的积分
    else if (currentStatus === 0) {
      const confirmMessage = '确定要重新上架吗？将扣除10积分';
      if (!window.confirm(confirmMessage)) return;
    }
    
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('toggle-post-status', {
        body: {
          user_id: user?.id,
          post_id: postId
        }
      })
      
      if (error) throw error
      
      // 更新用户积分（如果有积分变动）
      if (data?.data?.points_change !== 0 && user) {
        const { data: updatedUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (updatedUser) setUser(updatedUser)
      }
      
      alert(data?.data?.message || '操作成功')
      loadMyPosts()
    } catch (error: any) {
      alert(error.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setScreenshot(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRecharge = async () => {
    if (!user || !screenshot) {
      alert('请上传付款截图')
      return
    }

    // 验证充值金额
    let finalAmount: number
    let finalPoints: number

    if (isCustomRecharge) {
      finalAmount = parseInt(customAmount)
      if (!finalAmount || finalAmount < 1) {
        alert('请输入有效的充值金额（最少1元）')
        return
      }
      if (finalAmount > 100000) {
        alert('充值金额不能超过100000元')
        return
      }
      finalPoints = calculateCustomPoints(finalAmount)
    } else {
      finalAmount = rechargeAmount
      if (!finalAmount) {
        alert('请选择充值档位')
        return
      }
      const option = rechargeOptions.find(opt => opt.amount === finalAmount)
      finalPoints = option?.points || 0
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('recharge-request', {
        body: {
          user_id: user.id,
          amount: finalAmount,
          points: finalPoints,
          is_custom: isCustomRecharge,
          screenshot_data: screenshot
        }
      })

      if (error) throw error
      alert('充值申请已提交，请等待管理员审核')
      setScreenshot('')
      setActiveTab('overview')
      // 重置充值表单
      setRechargeAmount(50)
      setCustomAmount('')
      setIsCustomRecharge(false)
    } catch (error: any) {
      alert(error.message || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('请填写完整信息')
      return
    }

    if (newPassword.length < 6) {
      alert('密码至少需要6位')
      return
    }

    if (!/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
      alert('密码必须包含数字和字母')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('两次密码输入不一致')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('change-password', {
        body: {
          phone: user?.phone,
          old_password: oldPassword,
          new_password: newPassword
        }
      })

      if (error) throw error

      alert('密码修改成功')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setActiveTab('overview')
    } catch (error: any) {
      alert(error.message || '修改失败')
    } finally {
      setLoading(false)
    }
  }

  const rechargeOptions = [
    { amount: 50, points: 55, discount: '赠送5积分' },
    { amount: 100, points: 115, discount: '赠送15积分' },
    { amount: 300, points: 370, discount: '赠送70积分' },
    { amount: 500, points: 650, discount: '赠送150积分' }
  ]

  // 计算积分（1元=1积分，自定义充值）
  const calculateCustomPoints = (amount: number): number => {
    return Math.floor(amount) // 1元=1积分，无赠送
  }

  // 获取当前选中的积分数量
  const getCurrentPoints = () => {
    if (isCustomRecharge) {
      const amount = parseInt(customAmount) || 0
      return calculateCustomPoints(amount)
    }
    const option = rechargeOptions.find(opt => opt.amount === rechargeAmount)
    return option?.points || 0
  }

  // 处理自定义金额输入
  const handleCustomAmountChange = (value: string) => {
    // 只允许输入数字且最多6位
    const cleaned = value.replace(/\D/g, '').slice(0, 6)
    setCustomAmount(cleaned)
    
    // 如果输入金额，切换到自定义模式
    if (cleaned) {
      setIsCustomRecharge(true)
      setRechargeAmount(0) // 清除预设选项
    } else {
      setIsCustomRecharge(false)
    }
  }

  // 选择预设套餐时退出自定义模式
  const handleSelectPreset = (amount: number) => {
    setRechargeAmount(amount)
    setIsCustomRecharge(false)
    setCustomAmount('')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">个人中心</h1>
        </div>
      </div>

      {/* 公告展示 */}
      {visibleAnnouncements.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-orange-100">
          <div className="max-w-2xl mx-auto px-4 py-2">
            <div className="flex items-start gap-2">
              <Megaphone className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 overflow-hidden">
                {visibleAnnouncements.map((ann, index) => (
                  <div key={ann.id} className={`flex items-start justify-between gap-2 ${index > 0 ? 'mt-1 pt-1 border-t border-orange-100' : ''}`}>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-orange-700">{ann.title}：</span>
                      <span className="text-sm text-orange-600">{ann.content}</span>
                    </div>
                    <button
                      onClick={() => handleCloseAnnouncement(ann.id)}
                      className="text-orange-400 hover:text-orange-600 flex-shrink-0"
                      title="关闭此公告"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 text-white">
              <div className="text-sm opacity-90 mb-1">可用积分</div>
              <div className="text-4xl font-bold mb-4">{user?.points}</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="opacity-75">成交率</div>
                  <div className="font-semibold">{user?.deal_rate}%</div>
                </div>
                <div>
                  <div className="opacity-75">发布数</div>
                  <div className="font-semibold">{user?.total_posts}</div>
                </div>
                <div>
                  <div className="opacity-75">邀请数</div>
                  <div className="font-semibold">{user?.total_invites}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold mb-4">我的邀请码</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-3 bg-gray-100 rounded-lg font-mono text-xl">
                  {user?.invite_code}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user?.invite_code || '')
                    alert('邀请码已复制')
                  }}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              
              {/* 推荐链接 */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-sm font-medium text-gray-700 mb-2">我的推荐链接</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-purple-50 rounded-lg text-sm text-purple-700 truncate">
                    {`${window.location.origin}/register?ref=${user?.invite_code}`}
                  </div>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/register?ref=${user?.invite_code}`
                      navigator.clipboard.writeText(link)
                      alert('推荐链接已复制，分享给好友即可自动填充邀请码')
                    }}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm whitespace-nowrap"
                  >
                    复制链接
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 mt-3">
                邀请好友注册并完成首次发布，你可获得10积分，好友获得30积分
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold mb-3">快捷功能</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab('posts')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">我的发布</div>
                    <div className="text-xs text-gray-500">{user?.total_posts}条</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('aiPublish')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all"
                >
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">AI批量发布</div>
                    <div className="text-xs text-gray-500">智能生成</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">查看历史</div>
                    <div className="text-xs text-gray-500">最近记录</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('expired')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all"
                >
                  <Archive className="w-5 h-5 text-orange-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">过期帖子</div>
                    <div className="text-xs text-gray-500">已下架</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('rechargeHistory')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <Receipt className="w-5 h-5 text-green-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">充值记录</div>
                    <div className="text-xs text-gray-500">查看历史</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('points')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">积分明细</div>
                    <div className="text-xs text-gray-500">收支记录</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('invitations')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <Users className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">邀请奖励</div>
                    <div className="text-xs text-gray-500">{user?.total_invites || 0}人</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('changePassword')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <Key className="w-5 h-5 text-red-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">修改密码</div>
                    <div className="text-xs text-gray-500">账号安全</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('service')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <MessageCircle className="w-5 h-5 text-orange-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">联系客服</div>
                    <div className="text-xs text-gray-500">在线帮助</div>
                  </div>
                </button>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('recharge')}
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
            >
              充值积分
            </button>

            <button
              onClick={() => {
                localStorage.removeItem('token')
                setUser(null)
                navigate('/login')
              }}
              className="w-full py-3 bg-white text-gray-700 rounded-lg border hover:bg-gray-50 transition-all"
            >
              退出登录
            </button>
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-3">
            <button
              onClick={() => setActiveTab('overview')}
              className="text-blue-600 text-sm flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <h2 className="text-lg font-semibold mb-2">我的发布</h2>
            {myPosts.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                暂无发布记录
              </div>
            ) : (
              myPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 
                      className="font-semibold flex-1 cursor-pointer"
                      onClick={() => navigate(`/post/${post.id}`)}
                    >
                      {post.title}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded ${
                      post.status === 1 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {post.status === 1 ? '上架中' : '已下架'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-red-600 font-bold">¥{post.price}</span>
                    <span className="text-gray-500">
                      查看：{post.view_count}/{post.view_limit}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 mb-3">
                    发布时间：{new Date(post.created_at).toLocaleString()}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTogglePostStatus(post.id, post.status, post.view_count, post.view_limit)
                      }}
                      disabled={loading}
                      className="flex-1 py-2 px-3 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      {post.status === 1 ? '下架' : '上架'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/post/${post.id}`)
                      }}
                      className="flex-1 py-2 px-3 border border-blue-300 text-blue-600 rounded-lg text-sm hover:bg-blue-50 flex items-center justify-center gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      查看详情
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePost(post.id)
                      }}
                      disabled={loading}
                      className="py-2 px-3 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            <button
              onClick={() => setActiveTab('overview')}
              className="text-blue-600 text-sm flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <h2 className="text-lg font-semibold mb-2">查看历史</h2>
            {viewHistory.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                暂无查看记录
              </div>
            ) : (
              viewHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/post/${item.post_id}`)}
                  className="bg-white rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                >
                  <h3 className="font-semibold mb-2">{item.posts?.title}</h3>
                  <div className="text-sm text-gray-600">
                    查看时间：{new Date(item.viewed_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'points' && (
          <div className="space-y-2">
            <button
              onClick={() => setActiveTab('overview')}
              className="text-blue-600 text-sm mb-2 flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <h2 className="text-lg font-semibold mb-2">积分明细</h2>
            {pointTransactions.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                暂无积分变动记录
              </div>
            ) : (
              pointTransactions.map((tx) => (
                <div key={tx.id} className="bg-white rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{tx.description}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${tx.change_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.change_amount > 0 ? '+' : ''}{tx.change_amount}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'rechargeHistory' && (
          <div className="space-y-2">
            <button
              onClick={() => setActiveTab('overview')}
              className="text-blue-600 text-sm mb-2 flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <h2 className="text-lg font-semibold mb-2">充值记录</h2>
            {rechargeRecords.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                暂无充值记录
              </div>
            ) : (
              rechargeRecords.map((record) => (
                <div key={record.id} className="bg-white rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">充值 ¥{record.amount}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        +{record.points} 积分
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(record.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {record.status === 0 && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                          <Clock className="w-3 h-3" />
                          待审核
                        </span>
                      )}
                      {record.status === 1 && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          <CheckCircle className="w-3 h-3" />
                          已通过
                        </span>
                      )}
                      {record.status === 2 && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                          <XCircle className="w-3 h-3" />
                          已拒绝
                        </span>
                      )}
                    </div>
                  </div>
                  {record.admin_note && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                      管理员备注：{record.admin_note}
                    </div>
                  )}
                  {record.screenshot_url && (
                    <button
                      onClick={() => window.open(record.screenshot_url, '_blank')}
                      className="mt-2 text-xs text-blue-600"
                    >
                      查看付款截图
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'service' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('overview')}
              className="text-blue-600 text-sm flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">联系客服</h2>
              
              <div className="space-y-4">
                <div className="border-b pb-4">
                  <div className="text-sm text-gray-600 mb-2">微信客服</div>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-lg">{serviceSettings.service_wechat || '加载中...'}</div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(serviceSettings.service_wechat || '')
                        alert('微信号已复制')
                      }}
                      className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                    >
                      复制微信号
                    </button>
                  </div>
                </div>

                <div className="border-b pb-4">
                  <div className="text-sm text-gray-600 mb-2">QQ客服</div>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-lg">{serviceSettings.service_qq || '加载中...'}</div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(serviceSettings.service_qq || '')
                        alert('QQ号已复制')
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                    >
                      复制QQ号
                    </button>
                  </div>
                </div>

                <div className="border-b pb-4">
                  <div className="text-sm text-gray-600 mb-2">客服电话</div>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-lg">{serviceSettings.service_phone || '加载中...'}</div>
                    <a
                      href={`tel:${serviceSettings.service_phone || ''}`}
                      className="px-3 py-1 bg-orange-500 text-white rounded text-sm"
                    >
                      拨打电话
                    </a>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-sm mb-2">服务时间</h3>
                  <p className="text-sm text-gray-600">
                    {serviceSettings.service_hours || '周一至周日 9:00-22:00'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    如遇节假日，服务时间可能会有调整
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="font-medium text-sm mb-2">常见问题</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 充值后多久到账？通常5-30分钟内</li>
                    <li>• 如何获得积分？充值或邀请好友</li>
                    <li>• 发布信息需要多少积分？买入20分，卖出15分</li>
                    <li>• 如何提高成交率？完善信息并及时回复</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invitations' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('overview')}
              className="text-blue-600 text-sm flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            
            <InvitationStatistics />
          </div>
        )}

        {activeTab === 'recharge' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('overview')}
              className="text-blue-600 text-sm flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>

            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold mb-4">选择充值档位</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {rechargeOptions.map((option) => (
                  <button
                    key={option.amount}
                    onClick={() => handleSelectPreset(option.amount)}
                    className={`p-4 rounded-lg border-2 ${
                      rechargeAmount === option.amount && !isCustomRecharge
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="text-2xl font-bold">¥{option.amount}</div>
                    <div className="text-sm text-gray-600">{option.points}积分</div>
                    {option.discount && (
                      <div className="text-xs text-red-600 mt-1">{option.discount}</div>
                    )}
                  </button>
                ))}
              </div>

              {/* 自定义充值选项 */}
              <div className="mb-6">
                <div className="text-sm font-medium text-gray-700 mb-2">或自定义充值</div>
                <div className="relative">
                  <input
                    type="text"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    placeholder="输入充值金额（元）"
                    className={`w-full px-4 py-3 border-2 rounded-lg ${
                      isCustomRecharge ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                    } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    元
                  </div>
                </div>
                {isCustomRecharge && customAmount && (
                  <div className="mt-2 text-sm text-green-600">
                    将获得 {getCurrentPoints()} 积分（1元=1积分，无赠送）
                  </div>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  最小充值金额：1元，最大：100,000元
                </div>
              </div>

              {/* 当前选择显示 */}
              {(rechargeAmount > 0 || isCustomRecharge) && (
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <div className="text-sm text-blue-800 mb-1">当前选择</div>
                  <div className="text-lg font-semibold text-blue-900">
                    充值 ¥{isCustomRecharge ? customAmount : rechargeAmount} → {getCurrentPoints()} 积分
                  </div>
                  {isCustomRecharge && (
                    <div className="text-xs text-blue-700 mt-1">
                      规则：1元=1积分，无额外赠送
                    </div>
                  )}
                </div>
              )}

              {/* 收款二维码显示区域 */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">请扫码支付</h4>
                <div className="grid grid-cols-2 gap-4">
                  {paymentQRCodes.wechat && (
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-700 mb-2">微信支付</div>
                      <div className="bg-white border-2 border-green-500 rounded-lg p-3">
                        <img 
                          src={paymentQRCodes.wechat} 
                          alt="微信收款码" 
                          className="w-full h-auto rounded"
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-2">请使用微信扫码支付</div>
                    </div>
                  )}
                  {paymentQRCodes.alipay && (
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-700 mb-2">支付宝支付</div>
                      <div className="bg-white border-2 border-blue-500 rounded-lg p-3">
                        <img 
                          src={paymentQRCodes.alipay} 
                          alt="支付宝收款码" 
                          className="w-full h-auto rounded"
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-2">请使用支付宝扫码支付</div>
                    </div>
                  )}
                  {!paymentQRCodes.wechat && !paymentQRCodes.alipay && (
                    <div className="col-span-2 text-center py-6 text-gray-500">
                      <p className="text-sm">管理员暂未设置收款二维码</p>
                      <p className="text-xs mt-1">请联系客服获取收款方式</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">上传付款截图</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="screenshot-upload"
                  />
                  <label
                    htmlFor="screenshot-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-12 h-12 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">点击上传截图</span>
                  </label>
                  {screenshot && (
                    <img src={screenshot} alt="Screenshot" className="mt-4 max-h-40 mx-auto" />
                  )}
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">充值规则：</p>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>预设套餐：按套餐规则获得额外积分赠送</li>
                  <li>自定义充值：1元=1积分，无额外赠送</li>
                  <li>最小金额：1元，最大：100,000元</li>
                  <li>审核通过后积分将自动到账</li>
                </ul>
                <p className="text-xs text-yellow-700 mt-2">充值流程：选择金额 → 扫码支付 → 上传截图 → 提交申请</p>
              </div>

              <button
                onClick={handleRecharge}
                disabled={
                  loading || 
                  !screenshot || 
                  (!isCustomRecharge && !rechargeAmount) || 
                  (isCustomRecharge && (!customAmount || parseInt(customAmount) < 1))
                }
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? '提交中...' : '提交充值申请'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'changePassword' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('overview')}
              className="text-blue-600 text-sm flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>

            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold mb-4">修改密码</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    原密码
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="请输入原密码"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    新密码
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="至少6位，包含数字和字母"
                  />
                  {newPassword && (
                    <p className={`mt-1 text-xs ${
                      newPassword.length >= 6 && /\d/.test(newPassword) && /[a-zA-Z]/.test(newPassword)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {newPassword.length < 6
                        ? '密码至少需要6位'
                        : !/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)
                        ? '密码必须包含数字和字母'
                        : '密码强度良好'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    确认新密码
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="请再次输入新密码"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-600">两次密码输入不一致</p>
                  )}
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    密码修改后，需要使用新密码登录
                  </p>
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '修改中...' : '确认修改'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI批量发布标签页 */}
        {activeTab === 'aiPublish' && (
          <div>
            <button
              onClick={() => setActiveTab('overview')}
              className="text-blue-600 text-sm flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <UserAIBatchPublish
              userId={user?.id || ''}
              userWechatId={user?.wechat_id}
              onComplete={() => {
                setActiveTab('posts')
                loadMyPosts()
              }}
              onViewPublished={() => setActiveTab('posts')}
            />
          </div>
        )}

        {/* 过期帖子标签页 */}
        {activeTab === 'expired' && (
          <div>
            <button
              onClick={() => setActiveTab('overview')}
              className="text-blue-600 text-sm flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Archive className="w-5 h-5 text-orange-500" />
                  过期帖子管理
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  以下是3天后自动下架或手动下架的帖子记录
                </p>

                {expiredPosts.length === 0 ? (
                  <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                    <Archive className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>暂无过期帖子</p>
                    <p className="text-xs mt-1">上架的帖子将在3天后自动下架</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expiredPosts.map((post) => (
                      <div key={post.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium flex-1">{post.title}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                              {post.status === POST_STATUS.EXPIRED ? '3天到期' : '已下架'}
                            </span>
                            {post.hide_reason && (
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                {post.hide_reason === 'auto_expired' ? '自动到期' :
                                 post.hide_reason === 'manual' ? '手动下架' : '管理员下架'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-gray-600 mb-2">
                          <span className="mr-4">价格: ¥{post.price}</span>
                          <span className="mr-4">类型: {post.trade_type === 'transfer' ? '转让' : '求购'}</span>
                        </div>

                        <div className="text-xs text-gray-500 mb-2">
                          发布时间: {new Date(post.created_at).toLocaleString()}
                          {post.auto_hide_at && (
                            <span className="ml-4">
                              下架时间: {new Date(post.auto_hide_at).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {post.status === POST_STATUS.ACTIVE && autoHideService.isExpiringSoon(post.created_at) && (
                          <div className="flex items-start gap-2 p-2 bg-amber-100 text-amber-700 rounded text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">即将过期提醒</p>
                              <p className="text-xs">
                                此帖子将在 {autoHideService.getRemainingHours(post.created_at)} 小时后自动下架
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
