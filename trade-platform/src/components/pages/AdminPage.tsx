import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { supabase } from '../../services/supabase'
import { ArrowLeft, Users, FileText, DollarSign, Sparkles, TrendingUp, BarChart3 } from 'lucide-react'
import QRCodeManager from '../../features/QRCodeManager'
import AIBatchPublish from '../../features/forms/AIBatchPublish'
import KLineChart from '../../features/KLineChart'
import AnalyticsDashboard from '../../features/analytics/AnalyticsDashboard'

const RECHARGE_PACKAGES = [
  { amount: 50, points: 55, name: '充值套餐A' },
  { amount: 100, points: 115, name: '充值套餐B' },
  { amount: 300, points: 370, name: '充值套餐C' },
  { amount: 500, points: 650, name: '充值套餐D' }
]

const deriveRechargeMeta = (amount?: number, points?: number) => {
  if (!amount || !points) {
    return {
      packageName: '未知套餐',
      isCustom: true
    }
  }

  const preset = RECHARGE_PACKAGES.find(pkg => pkg.amount === amount && pkg.points === points)
  if (preset) {
    return {
      packageName: preset.name,
      isCustom: false
    }
  }

  return {
    packageName: '自定义充值',
    isCustom: true
  }
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [rechargeRequests, setRechargeRequests] = useState<any[]>([])
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [stats, setStats] = useState({ totalUsers: 0, totalPosts: 0, pendingRecharges: 0 })
  const [postFilter, setPostFilter] = useState<'all' | 'active' | 'inactive'>('all') // 信息筛选状态
  const [userSearch, setUserSearch] = useState('') // 用户搜索关键词
  const [userSortBy, setUserSortBy] = useState<'time' | 'posts' | 'points'>('time') // 用户排序方式
  const { user } = useUser()
  const navigate = useNavigate()

  // 权限验证
  useEffect(() => {
    if (!user) {
      alert('请先登录')
      navigate('/login')
      return
    }
    
    // 检查是否为管理员
    if (user.role !== 'admin' && !user.is_admin) {
      alert('抱歉，您没有权限访问此页面')
      navigate('/')
      return
    }
  }, [user, navigate])

  useEffect(() => {
    if (user && (user.role === 'admin' || user.is_admin)) {
      loadStats()
      if (activeTab === 'users') loadUsers()
      if (activeTab === 'posts') loadPosts()
      if (activeTab === 'recharge') loadRechargeRequests()
    }
  }, [activeTab, user])

  const loadStats = async () => {
    const { data: usersData } = await supabase.from('users').select('id', { count: 'exact' })
    const { data: postsData } = await supabase.from('posts').select('id', { count: 'exact' })
    const { data: rechargesData } = await supabase
      .from('recharge_requests')
      .select('id', { count: 'exact' })
      .eq('status', 0)
    
    setStats({
      totalUsers: usersData?.length || 0,
      totalPosts: postsData?.length || 0,
      pendingRecharges: rechargesData?.length || 0
    })
  }

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data || [])
  }

  const loadPosts = async (filter: 'all' | 'active' | 'inactive' = postFilter) => {
    let query = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    // 根据筛选条件过滤
    if (filter === 'active') {
      query = query.eq('status', 1) // 上架中
    } else if (filter === 'inactive') {
      query = query.eq('status', 0) // 已下架
    }
    
    const { data } = await query
    setPosts(data || [])
  }

  const loadRechargeRequests = async () => {
    const { data } = await supabase
      .from('recharge_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) {
      setRechargeRequests([])
      return
    }

    const userIds = Array.from(new Set(data.map(req => req.user_id).filter(Boolean)))
    const userLookup: Record<string, any> = {}

    if (userIds.length > 0) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, phone, wechat_id, points')
        .in('id', userIds)

      userData?.forEach((u) => {
        userLookup[u.id] = u
      })
    }

    const enhanced = data.map((req) => {
      const meta = deriveRechargeMeta(
        typeof req.amount === 'number' ? req.amount : Number(req.amount),
        typeof req.points === 'number' ? req.points : Number(req.points)
      )

      return {
        ...req,
        userProfile: userLookup[req.user_id] || null,
        package_name: req.package_name || meta.packageName,
        is_custom: typeof req.is_custom === 'boolean' ? req.is_custom : meta.isCustom
      }
    })

    setRechargeRequests(enhanced)
  }

  const handleToggleUserStatus = async (userId: string, currentStatus: number) => {
    const newStatus = currentStatus === 1 ? 0 : 1
    const { error } = await supabase
      .from('users')
      .update({ status: newStatus })
      .eq('id', userId)
    
    if (!error) {
      loadUsers()
      alert(newStatus === 1 ? '用户已启用' : '用户已禁用')
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('确定要删除这条信息吗？')) return
    
    const { error } = await supabase
      .from('posts')
      .update({ status: 0 })
      .eq('id', postId)
    
    if (!error) {
      loadPosts()
      alert('删除成功')
    }
  }

  const handleApproveRecharge = async (requestId: string, approved: boolean) => {
    if (!user) return
    
    const message = approved ? '确定通过此充值申请吗？' : '确定拒绝此充值申请吗？'
    if (!window.confirm(message)) return

    try {
      const { data, error } = await supabase.functions.invoke('admin-approve-recharge', {
        body: {
          admin_id: user.id,
          request_id: requestId,
          approved,
          admin_note: ''
        }
      })

      if (error) {
        throw new Error(error.message || '操作失败')
      }

      // 检查返回数据中是否有错误
      if (data?.error) {
        throw new Error(data.error.message || '操作失败')
      }

      loadRechargeRequests()
      loadStats()
      alert(approved ? '充值已通过，积分已到账' : '充值已拒绝')
    } catch (err: any) {
      alert(err.message || '操作失败，请稍后重试')
      // 刷新列表以获取最新状态
      loadRechargeRequests()
    }
  }

  const handleAiBatchPublish = async () => {
    if (!aiText.trim() || !user) {
      alert('请输入要解析的文本')
      return
    }

    setAiLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-batch-publish', {
        body: {
          user_id: user.id,
          text_input: aiText,
          trade_type: 2
        }
      })

      if (error) throw error

      if (data?.data) {
        alert(`成功解析${data.data.parsed_count}条信息，创建${data.data.created_count}条`)
        setAiText('')
        loadPosts()
        loadStats()
      }
    } catch (error: any) {
      alert(error.message || 'AI解析失败')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/')}>
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold">管理后台</h1>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <div className="text-sm opacity-90">总用户数</div>
              <div className="text-3xl font-bold mt-1">{stats.totalUsers}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <div className="text-sm opacity-90">总信息数</div>
              <div className="text-3xl font-bold mt-1">{stats.totalPosts}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <div className="text-sm opacity-90">待审核</div>
              <div className="text-3xl font-bold mt-1">{stats.pendingRecharges}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-3">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === 'users' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
              }`}
            >
              <Users className="w-4 h-4" />
              用户管理
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === 'posts' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
              }`}
            >
              <FileText className="w-4 h-4" />
              信息管理
            </button>
            <button
              onClick={() => setActiveTab('recharge')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === 'recharge' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              充值审核
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === 'ai' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI批量发布
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === 'analytics' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              数据分析
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'users' && (
          <div className="space-y-3">
            {/* 搜索和排序 */}
            <div className="bg-white rounded-lg p-4 space-y-3">
              {/* 搜索框 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="搜索手机号或微信号..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch('')}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    清除
                  </button>
                )}
              </div>
              
              {/* 排序按钮 */}
              <div className="flex gap-2 flex-wrap">
                <span className="text-sm text-gray-500 flex items-center mr-2">排序：</span>
                <button
                  onClick={() => setUserSortBy('time')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    userSortBy === 'time' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  注册时间
                </button>
                <button
                  onClick={() => setUserSortBy('posts')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    userSortBy === 'posts' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📊 发布数排行
                </button>
                <button
                  onClick={() => setUserSortBy('points')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    userSortBy === 'points' 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  💰 积分排行
                </button>
              </div>
            </div>

            {/* 用户列表 */}
            {(() => {
              // 过滤用户
              let filteredUsers = users.filter(u => {
                if (!userSearch) return true
                const search = userSearch.toLowerCase()
                return (
                  u.phone?.toLowerCase().includes(search) ||
                  u.wechat_id?.toLowerCase().includes(search)
                )
              })
              
              // 排序用户
              if (userSortBy === 'posts') {
                filteredUsers = [...filteredUsers].sort((a, b) => (b.total_posts || 0) - (a.total_posts || 0))
              } else if (userSortBy === 'points') {
                filteredUsers = [...filteredUsers].sort((a, b) => (b.points || 0) - (a.points || 0))
              }
              // time 排序已经在 loadUsers 中处理了
              
              if (filteredUsers.length === 0) {
                return (
                  <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                    {userSearch ? '未找到匹配的用户' : '暂无用户'}
                  </div>
                )
              }
              
              return filteredUsers.map((u, index) => (
                <div key={u.id} className="bg-white rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start gap-3">
                      {/* 排名标识 */}
                      {userSortBy !== 'time' && index < 3 && (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                        }`}>
                          {index + 1}
                        </div>
                      )}
                      {userSortBy !== 'time' && index >= 3 && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600 font-medium text-sm">
                          {index + 1}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold">{u.phone}</div>
                        <div className="text-sm text-gray-600">微信：{u.wechat_id}</div>
                        <div className="text-sm text-gray-600">邀请码：{u.invite_code}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleUserStatus(u.id, u.status)}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        u.status === 1
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {u.status === 1 ? '禁用' : '启用'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className={userSortBy === 'points' ? 'bg-yellow-50 rounded px-2 py-1' : ''}>
                      <span className="text-gray-500">积分：</span>
                      <span className={`font-medium ${userSortBy === 'points' ? 'text-yellow-700' : ''}`}>
                        {u.points || 0}
                      </span>
                    </div>
                    <div className={userSortBy === 'posts' ? 'bg-blue-50 rounded px-2 py-1' : ''}>
                      <span className="text-gray-500">发布：</span>
                      <span className={`font-medium ${userSortBy === 'posts' ? 'text-blue-700' : ''}`}>
                        {u.total_posts || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">成交率：</span>
                      <span className="font-medium">{u.deal_rate || 0}%</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    注册时间：{new Date(u.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-3">
            {/* 筛选按钮 */}
            <div className="bg-white rounded-lg p-3 flex gap-2">
              <button
                onClick={() => { setPostFilter('all'); loadPosts('all'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  postFilter === 'all' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => { setPostFilter('active'); loadPosts('active'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  postFilter === 'active' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                上架中
              </button>
              <button
                onClick={() => { setPostFilter('inactive'); loadPosts('inactive'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  postFilter === 'inactive' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                已下架
              </button>
            </div>
            
            {posts.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                暂无{postFilter === 'active' ? '上架中的' : postFilter === 'inactive' ? '已下架的' : ''}信息
              </div>
            ) : posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{post.title}</h3>
                    <div className="text-sm text-gray-600">价格：¥{post.price}</div>
                    <div className="text-sm text-gray-600">
                      查看：{post.view_count}/{post.view_limit}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm"
                  >
                    下架
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-400">
                    {new Date(post.created_at).toLocaleString()}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    post.status === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {post.status === 1 ? '上架中' : '已下架'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'recharge' && (
          <div className="space-y-3">
            <QRCodeManager />
            
            {/* 充值记录筛选 */}
            <div className="bg-white rounded-lg p-3 flex gap-2 flex-wrap">
              <button
                onClick={() => loadRechargeRequests()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white"
              >
                全部 ({rechargeRequests.length})
              </button>
              <span className="text-sm text-gray-500 flex items-center">
                待审核: {rechargeRequests.filter(r => r.status === 0).length} | 
                已通过: {rechargeRequests.filter(r => r.status === 1).length} | 
                已拒绝: {rechargeRequests.filter(r => r.status === 2).length}
              </span>
            </div>
            
            {rechargeRequests.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                暂无充值申请记录
              </div>
            ) : (
              rechargeRequests.map((req) => {
                const currentBalance = req.userProfile?.points || 0
                const newBalance = req.status === 1 ? currentBalance : currentBalance + req.points
                
                return (
                  <div key={req.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    {/* 头部信息 */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-lg font-bold text-blue-600">
                            ¥{req.amount}
                          </div>
                          <div className="text-lg text-gray-700">
                            → +{req.points}积分
                          </div>
                          {req.is_custom && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                              自定义
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">充值套餐：</span>
                            <span className="font-medium">{req.package_name || '未知套餐'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">用户：</span>
                            <span className="font-medium">{req.userProfile?.phone || '未知'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">当前积分：</span>
                            <span className="font-medium">{currentBalance}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">充值后积分：</span>
                            <span className="font-medium text-green-600">{newBalance}</span>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-400 mt-2">
                          申请时间：{new Date(req.created_at).toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            req.status === 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : req.status === 1
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {req.status === 0 ? '待审核' : req.status === 1 ? '已通过' : '已拒绝'}
                        </span>
                        
                        {req.status === 1 && req.processed_at && (
                          <div className="text-xs text-gray-500">
                            通过时间：{new Date(req.processed_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 付款截图 */}
                    {req.screenshot_url && (
                      <div className="mb-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">付款截图</div>
                        <img
                          src={req.screenshot_url}
                          alt="付款截图"
                          className="max-h-64 object-contain rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => window.open(req.screenshot_url, '_blank')}
                        />
                      </div>
                    )}

                    {/* 管理员备注 */}
                    {req.admin_note && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">管理员备注</div>
                        <div className="text-sm text-gray-600">{req.admin_note}</div>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    {req.status === 0 && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApproveRecharge(req.id, true)}
                          className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                          ✓ 通过充值
                        </button>
                        <button
                          onClick={() => handleApproveRecharge(req.id, false)}
                          className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                        >
                          ✗ 拒绝充值
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <AIBatchPublish 
            userId={user?.id || ''} 
            onComplete={() => { 
              // 发布完成时只刷新数据
              loadPosts(); 
              loadStats(); 
            }}
            onViewPublished={() => {
              // 查看发布信息时切换到信息管理标签
              loadPosts();
              loadStats();
              setActiveTab('posts');
            }}
          />
        )}

        {activeTab === 'analytics' && <AnalyticsDashboard />}
      </div>
    </div>
  )
}
