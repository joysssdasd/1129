import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { supabase } from '../../services/supabase'
import { ArrowLeft, Users, FileText, DollarSign, Sparkles, TrendingUp, BarChart3 } from 'lucide-react'
import QRCodeManager from '../../features/QRCodeManager'
import AIBatchPublish from '../../features/forms/AIBatchPublish'
import KLineChart from '../../features/KLineChart'
import AnalyticsDashboard from '../../features/analytics/AnalyticsDashboard'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [rechargeRequests, setRechargeRequests] = useState<any[]>([])
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [stats, setStats] = useState({ totalUsers: 0, totalPosts: 0, pendingRecharges: 0 })
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

  const loadPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setPosts(data || [])
  }

  const loadRechargeRequests = async () => {
    const { data } = await supabase
      .from('recharge_requests')
      .select('*, users!recharge_requests_user_id_fkey(phone, wechat_id, points)')
      .order('created_at', { ascending: false })
    setRechargeRequests(data || [])
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

    const { error } = await supabase.functions.invoke('admin-approve-recharge', {
      body: {
        admin_id: user.id,
        request_id: requestId,
        approved,
        admin_note: ''
      }
    })

    if (!error) {
      loadRechargeRequests()
      loadStats()
      alert(approved ? '充值已通过' : '充值已拒绝')
    } else {
      alert('操作失败')
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
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold">{u.phone}</div>
                    <div className="text-sm text-gray-600">微信：{u.wechat_id}</div>
                    <div className="text-sm text-gray-600">邀请码：{u.invite_code}</div>
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
                  <div>
                    <span className="text-gray-500">积分：</span>
                    <span className="font-medium">{u.points}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">发布：</span>
                    <span className="font-medium">{u.total_posts}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">成交率：</span>
                    <span className="font-medium">{u.deal_rate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-3">
            {posts.map((post) => (
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
                <div className="text-xs text-gray-400">
                  {new Date(post.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'recharge' && (
          <div className="space-y-3">
            <QRCodeManager />
            
            {rechargeRequests.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                暂无充值申请记录
              </div>
            ) : (
              rechargeRequests.map((req) => {
                const currentBalance = req.users?.points || 0
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
                            <span className="font-medium">{req.users?.phone}</span>
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
