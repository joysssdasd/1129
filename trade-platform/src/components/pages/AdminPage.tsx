import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { supabase } from '../../services/supabase'
import { ArrowLeft, Users, FileText, DollarSign, Sparkles, BarChart3, Megaphone, Edit, Trash2, Plus, Settings, Ban, Coins, Flag, CheckCircle, XCircle, Eye, Grid3x3 } from 'lucide-react'
import QRCodeManager from '../../features/QRCodeManager'
import AIBatchPublish from '../../features/forms/AIBatchPublish'
import AnalyticsDashboard from '../../features/analytics/AnalyticsDashboard'
import CategoryManagement from '../CategoryManagement'

const RECHARGE_PACKAGES = [
  { amount: 50, points: 55, name: '充值套餐A' },
  { amount: 100, points: 115, name: '充值套餐B' },
  { amount: 300, points: 370, name: '充值套餐C' },
  { amount: 500, points: 650, name: '充值套餐D' }
]

interface Announcement {
  id: string
  title: string
  content: string
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface SystemSetting {
  id: string
  key: string
  value: string
  description: string
  category: string
}

interface BannedKeyword {
  id: string
  keyword: string
  created_at: string
}

interface Report {
  id: string
  post_id: string
  reporter_id: string
  report_type: string
  description: string
  status: number
  admin_note: string
  processed_by: string
  processed_at: string
  created_at: string
  post?: any
  reporter?: any
}

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
  // 公告管理相关状态
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', priority: 0, is_active: true })
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  // 系统设置相关状态
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([])
  const [bannedKeywords, setBannedKeywords] = useState<BannedKeyword[]>([])
  const [newBannedKeyword, setNewBannedKeyword] = useState('')
  // 举报管理相关状态
  const [reports, setReports] = useState<Report[]>([])
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'processed' | 'rejected'>('pending')
  // 积分调整相关状态
  const [adjustUserId, setAdjustUserId] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  // 用户详情相关状态
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showUserDetail, setShowUserDetail] = useState(false)
  const [userPointHistory, setUserPointHistory] = useState<any[]>([])
  const [userPosts, setUserPosts] = useState<any[]>([])
  const [loadingUserDetail, setLoadingUserDetail] = useState(false)
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
      if (activeTab === 'announcements') loadAnnouncements()
      if (activeTab === 'settings') { loadSystemSettings(); loadBannedKeywords() }
      if (activeTab === 'reports') loadReports()
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

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
    setAnnouncements(data || [])
  }

  const loadSystemSettings = async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('*')
      .order('category')
    setSystemSettings(data || [])
  }

  const loadBannedKeywords = async () => {
    const { data } = await supabase
      .from('banned_keywords')
      .select('*')
      .order('created_at', { ascending: false })
    setBannedKeywords(data || [])
  }

  // 举报管理加载
  const loadReports = async (filter: 'all' | 'pending' | 'processed' | 'rejected' = reportFilter) => {
    let query = supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (filter === 'pending') {
      query = query.eq('status', 0)
    } else if (filter === 'processed') {
      query = query.eq('status', 1)
    } else if (filter === 'rejected') {
      query = query.eq('status', 2)
    }
    
    const { data } = await query
    
    if (data && data.length > 0) {
      // 获取关联的帖子和举报人信息
      const postIds = [...new Set(data.map(r => r.post_id))]
      const reporterIds = [...new Set(data.map(r => r.reporter_id))]
      
      const [postsRes, usersRes] = await Promise.all([
        supabase.from('posts').select('id, title, status').in('id', postIds),
        supabase.from('users').select('id, phone').in('id', reporterIds)
      ])
      
      const postsMap: Record<string, any> = {}
      const usersMap: Record<string, any> = {}
      
      postsRes.data?.forEach(p => { postsMap[p.id] = p })
      usersRes.data?.forEach(u => { usersMap[u.id] = u })
      
      const enrichedReports = data.map(r => ({
        ...r,
        post: postsMap[r.post_id],
        reporter: usersMap[r.reporter_id]
      }))
      
      setReports(enrichedReports)
    } else {
      setReports([])
    }
  }

  // 处理举报
  const handleProcessReport = async (reportId: string, action: 'approve' | 'reject', takeDownPost: boolean = false) => {
    const newStatus = action === 'approve' ? 1 : 2
    const adminNote = action === 'approve' 
      ? (takeDownPost ? '举报属实，已下架帖子' : '举报属实，已处理')
      : '举报不属实，已驳回'
    
    const { error } = await supabase
      .from('reports')
      .update({
        status: newStatus,
        admin_note: adminNote,
        processed_by: user?.id,
        processed_at: new Date().toISOString()
      })
      .eq('id', reportId)
    
    if (error) {
      alert('处理失败：' + error.message)
      return
    }
    
    // 如果需要下架帖子
    if (action === 'approve' && takeDownPost) {
      const report = reports.find(r => r.id === reportId)
      if (report?.post_id) {
        await supabase
          .from('posts')
          .update({ status: 0 })
          .eq('id', report.post_id)
      }
    }
    
    loadReports()
    alert(action === 'approve' ? '举报已处理' : '举报已驳回')
  }

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'illegal': '违法违规',
      'infringement': '侵权内容',
      'false': '虚假信息',
      'other': '其他问题'
    }
    return labels[type] || type
  }

  // 公告管理操作
  const handleSaveAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      alert('请填写标题和内容')
      return
    }

    if (editingAnnouncement) {
      const { error } = await supabase
        .from('announcements')
        .update({
          title: announcementForm.title,
          content: announcementForm.content,
          priority: announcementForm.priority,
          is_active: announcementForm.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingAnnouncement.id)
      
      if (error) {
        alert('更新失败：' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('announcements')
        .insert({
          title: announcementForm.title,
          content: announcementForm.content,
          priority: announcementForm.priority,
          is_active: announcementForm.is_active,
          created_by: user?.id
        })
      
      if (error) {
        alert('创建失败：' + error.message)
        return
      }
    }

    setShowAnnouncementForm(false)
    setEditingAnnouncement(null)
    setAnnouncementForm({ title: '', content: '', priority: 0, is_active: true })
    loadAnnouncements()
    alert(editingAnnouncement ? '公告已更新' : '公告已创建')
  }

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm('确定要删除这条公告吗？')) return
    
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) {
      alert('删除失败：' + error.message)
      return
    }
    loadAnnouncements()
    alert('公告已删除')
  }

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setAnnouncementForm({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      is_active: announcement.is_active
    })
    setShowAnnouncementForm(true)
  }

  // 系统设置操作
  const handleUpdateSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from('system_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
    
    if (error) {
      alert('更新失败：' + error.message)
      return
    }
    loadSystemSettings()
  }

  // 禁用关键词操作
  const handleAddBannedKeyword = async () => {
    if (!newBannedKeyword.trim()) {
      alert('请输入关键词')
      return
    }
    
    const { error } = await supabase
      .from('banned_keywords')
      .insert({ keyword: newBannedKeyword.trim(), created_by: user?.id })
    
    if (error) {
      if (error.code === '23505') {
        alert('该关键词已存在')
      } else {
        alert('添加失败：' + error.message)
      }
      return
    }
    
    setNewBannedKeyword('')
    loadBannedKeywords()
  }

  const handleDeleteBannedKeyword = async (id: string) => {
    const { error } = await supabase.from('banned_keywords').delete().eq('id', id)
    if (error) {
      alert('删除失败：' + error.message)
      return
    }
    loadBannedKeywords()
  }

  // 积分调整操作
  const handleAdjustPoints = async () => {
    if (!adjustUserId || !adjustAmount || !adjustReason.trim()) {
      alert('请填写完整信息')
      return
    }

    const amount = parseInt(adjustAmount)
    if (isNaN(amount) || amount === 0) {
      alert('请输入有效的积分数量')
      return
    }

    // 查找用户
    const targetUser = users.find(u => u.id === adjustUserId || u.phone === adjustUserId)
    if (!targetUser) {
      alert('未找到该用户')
      return
    }

    // 检查积分是否足够（如果是扣除）
    if (amount < 0 && targetUser.points + amount < 0) {
      alert('用户积分不足')
      return
    }

    // 更新用户积分
    const { error: updateError } = await supabase
      .from('users')
      .update({ points: targetUser.points + amount })
      .eq('id', targetUser.id)

    if (updateError) {
      alert('调整失败：' + updateError.message)
      return
    }

    // 记录积分变动
    await supabase.from('point_transactions').insert({
      user_id: targetUser.id,
      change_amount: amount,
      balance_after: targetUser.points + amount,
      change_type: amount > 0 ? 6 : 7,
      description: `管理员调整：${adjustReason}`
    })

    // 记录管理员操作
    await supabase.from('admin_point_adjustments').insert({
      user_id: targetUser.id,
      admin_id: user?.id,
      amount,
      reason: adjustReason
    })

    setAdjustUserId('')
    setAdjustAmount('')
    setAdjustReason('')
    loadUsers()
    alert(`已${amount > 0 ? '增加' : '扣除'}${Math.abs(amount)}积分`)
  }

  // 加载用户详情
  const loadUserDetail = async (userId: string) => {
    setLoadingUserDetail(true)
    try {
      // 加载积分变动历史
      const { data: pointHistory } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      
      setUserPointHistory(pointHistory || [])

      // 加载用户所有帖子（包括已下架的）
      const { data: userPostsData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      setUserPosts(userPostsData || [])
    } catch (error: any) {
      alert('加载用户详情失败：' + error.message)
    } finally {
      setLoadingUserDetail(false)
    }
  }

  // 打开用户详情
  const handleViewUserDetail = async (u: any) => {
    setSelectedUser(u)
    setShowUserDetail(true)
    await loadUserDetail(u.id)
  }

  // 关闭用户详情
  const handleCloseUserDetail = () => {
    setShowUserDetail(false)
    setSelectedUser(null)
    setUserPointHistory([])
    setUserPosts([])
  }

  // 获取积分变动类型标签
  const getPointChangeTypeLabel = (type: number) => {
    const labels: Record<number, string> = {
      1: '注册奖励',
      2: '发布交易信息',
      3: '查看联系方式',
      4: '充值',
      5: '邀请奖励',
      6: '管理员增加',
      7: '管理员扣除',
      8: '重新上架扣除',
      9: '每日发帖奖励',
      10: '注册送积分补齐'
    }
    return labels[type] || '其他'
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
            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === 'categories' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
              板块管理
            </button>
            <button
              onClick={() => setActiveTab('announcements')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === 'announcements' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              公告管理
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === 'settings' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
              }`}
            >
              <Settings className="w-4 h-4" />
              系统设置
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === 'reports' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
              }`}
            >
              <Flag className="w-4 h-4" />
              举报管理
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewUserDetail(u)}
                        className="px-3 py-1 rounded-lg text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        查看详情
                      </button>
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
                  
                  {/* 积分调整 */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="积分数量"
                        className="w-24 px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500"
                        id={`adjust-amount-${u.id}`}
                      />
                      <input
                        type="text"
                        placeholder="调整原因"
                        className="flex-1 px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500"
                        id={`adjust-reason-${u.id}`}
                      />
                      <button
                        onClick={async () => {
                          const amountInput = document.getElementById(`adjust-amount-${u.id}`) as HTMLInputElement
                          const reasonInput = document.getElementById(`adjust-reason-${u.id}`) as HTMLInputElement
                          const amount = parseInt(amountInput?.value || '0')
                          const reason = reasonInput?.value || ''
                          
                          if (!amount || amount === 0) {
                            alert('请输入有效的积分数量')
                            return
                          }
                          if (!reason.trim()) {
                            alert('请输入调整原因')
                            return
                          }
                          if (amount < 0 && u.points + amount < 0) {
                            alert('用户积分不足')
                            return
                          }
                          
                          const { error } = await supabase
                            .from('users')
                            .update({ points: u.points + amount })
                            .eq('id', u.id)
                          
                          if (error) {
                            alert('调整失败：' + error.message)
                            return
                          }
                          
                          await supabase.from('point_transactions').insert({
                            user_id: u.id,
                            change_amount: amount,
                            balance_after: u.points + amount,
                            change_type: amount > 0 ? 6 : 7,
                            description: `管理员调整：${reason}`
                          })
                          
                          amountInput.value = ''
                          reasonInput.value = ''
                          loadUsers()
                          alert(`已${amount > 0 ? '增加' : '扣除'}${Math.abs(amount)}积分`)
                        }}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        <Coins className="w-4 h-4" />
                      </button>
                    </div>
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

        {/* 板块管理 */}
        {activeTab === 'categories' && <CategoryManagement />}

        {/* 公告管理 */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">公告管理</h2>
              <button
                onClick={() => {
                  setEditingAnnouncement(null)
                  setAnnouncementForm({ title: '', content: '', priority: 0, is_active: true })
                  setShowAnnouncementForm(true)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" />
                新增公告
              </button>
            </div>

            {/* 公告表单 */}
            {showAnnouncementForm && (
              <div className="bg-white rounded-lg p-6 border-2 border-purple-200">
                <h3 className="font-semibold mb-4">{editingAnnouncement ? '编辑公告' : '新增公告'}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">标题</label>
                    <input
                      type="text"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="输入公告标题"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">内容</label>
                    <textarea
                      value={announcementForm.content}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 h-32"
                      placeholder="输入公告内容"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">优先级（数字越大越靠前）</label>
                      <input
                        type="number"
                        value={announcementForm.priority}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">状态</label>
                      <select
                        value={announcementForm.is_active ? 'active' : 'inactive'}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, is_active: e.target.value === 'active' })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="active">启用</option>
                        <option value="inactive">禁用</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveAnnouncement}
                      className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => {
                        setShowAnnouncementForm(false)
                        setEditingAnnouncement(null)
                      }}
                      className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 公告列表 */}
            {announcements.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                暂无公告
              </div>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className={`bg-white rounded-lg p-4 border-l-4 ${ann.is_active ? 'border-green-500' : 'border-gray-300'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{ann.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${ann.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {ann.is_active ? '启用' : '禁用'}
                        </span>
                        <span className="text-xs text-gray-500">优先级: {ann.priority}</span>
                      </div>
                      <p className="text-gray-600 mt-1 whitespace-pre-wrap">{ann.content}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditAnnouncement(ann)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    创建时间：{new Date(ann.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 系统设置 */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* 交易设置 */}
            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                交易设置
              </h3>
              <div className="space-y-4">
                {systemSettings.filter(s => s.category === 'trade').map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{setting.description}</div>
                      <div className="text-xs text-gray-500">key: {setting.key}</div>
                    </div>
                    {setting.key === 'post_expire_days' ? (
                      <select
                        value={setting.value}
                        onChange={(e) => handleUpdateSetting(setting.key, e.target.value)}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => (
                          <option key={d} value={d}>{d}天</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={setting.value}
                        onChange={(e) => handleUpdateSetting(setting.key, e.target.value)}
                        className="w-24 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-center"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 邀请奖励设置 */}
            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-600" />
                邀请奖励设置
              </h3>
              <div className="space-y-4">
                {systemSettings.filter(s => s.category === 'invite').map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{setting.description}</div>
                    </div>
                    <input
                      type="number"
                      value={setting.value}
                      onChange={(e) => handleUpdateSetting(setting.key, e.target.value)}
                      className="w-24 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 客服联系方式 */}
            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                客服联系方式
              </h3>
              <div className="space-y-4">
                {systemSettings.filter(s => s.category === 'service').map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between gap-4">
                    <div className="flex-shrink-0">
                      <div className="font-medium">{setting.description}</div>
                    </div>
                    <input
                      type="text"
                      value={setting.value}
                      onChange={(e) => handleUpdateSetting(setting.key, e.target.value)}
                      className="flex-1 max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 禁用关键词管理 */}
            <div className="bg-white rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-600" />
                禁用关键词（敏感词过滤）
              </h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newBannedKeyword}
                  onChange={(e) => setNewBannedKeyword(e.target.value)}
                  placeholder="输入要禁用的关键词"
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddBannedKeyword()}
                />
                <button
                  onClick={handleAddBannedKeyword}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  添加
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {bannedKeywords.map((kw) => (
                  <span
                    key={kw.id}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                  >
                    {kw.keyword}
                    <button
                      onClick={() => handleDeleteBannedKeyword(kw.id)}
                      className="hover:text-red-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {bannedKeywords.length === 0 && (
                  <span className="text-gray-500 text-sm">暂无禁用关键词</span>
                )}
              </div>
            </div>


          </div>
        )}

        {/* 举报管理 */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-600" />
                举报管理
              </h2>
            </div>

            {/* 筛选按钮 */}
            <div className="bg-white rounded-lg p-3 flex gap-2 flex-wrap">
              <button
                onClick={() => { setReportFilter('pending'); loadReports('pending'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  reportFilter === 'pending' 
                    ? 'bg-yellow-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                待处理
              </button>
              <button
                onClick={() => { setReportFilter('processed'); loadReports('processed'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  reportFilter === 'processed' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                已处理
              </button>
              <button
                onClick={() => { setReportFilter('rejected'); loadReports('rejected'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  reportFilter === 'rejected' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                已驳回
              </button>
              <button
                onClick={() => { setReportFilter('all'); loadReports('all'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  reportFilter === 'all' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
            </div>

            {/* 举报列表 */}
            {reports.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                暂无{reportFilter === 'pending' ? '待处理的' : reportFilter === 'processed' ? '已处理的' : reportFilter === 'rejected' ? '已驳回的' : ''}举报
              </div>
            ) : (
              reports.map((report) => (
                <div key={report.id} className={`bg-white rounded-lg p-4 border-l-4 ${
                  report.status === 0 ? 'border-yellow-500' : report.status === 1 ? 'border-green-500' : 'border-red-500'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          report.report_type === 'illegal' ? 'bg-red-100 text-red-700' :
                          report.report_type === 'infringement' ? 'bg-orange-100 text-orange-700' :
                          report.report_type === 'false' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {getReportTypeLabel(report.report_type)}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          report.status === 0 ? 'bg-yellow-100 text-yellow-700' :
                          report.status === 1 ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {report.status === 0 ? '待处理' : report.status === 1 ? '已处理' : '已驳回'}
                        </span>
                      </div>
                      
                      {/* 被举报帖子信息 */}
                      <div className="bg-gray-50 rounded p-3 mb-2">
                        <div className="text-sm font-medium text-gray-700 mb-1">被举报帖子</div>
                        <div className="text-sm">
                          {report.post ? (
                            <div className="flex items-center justify-between">
                              <span>{report.post.title}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                report.post.status === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {report.post.status === 1 ? '上架中' : '已下架'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">帖子已删除</span>
                          )}
                        </div>
                      </div>
                      
                      {/* 举报描述 */}
                      {report.description && (
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">举报说明：</span>{report.description}
                        </div>
                      )}
                      
                      {/* 举报人信息 */}
                      <div className="text-xs text-gray-500">
                        举报人：{report.reporter?.phone || '未知'} | 
                        举报时间：{new Date(report.created_at).toLocaleString()}
                      </div>
                      
                      {/* 处理备注 */}
                      {report.admin_note && (
                        <div className="mt-2 text-sm text-gray-600 bg-blue-50 rounded p-2">
                          <span className="font-medium">处理备注：</span>{report.admin_note}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 操作按钮 */}
                  {report.status === 0 && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => report.post_id && window.open(`/post/${report.post_id}`, '_blank')}
                        className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200"
                      >
                        <Eye className="w-4 h-4" />
                        查看帖子
                      </button>
                      <button
                        onClick={() => handleProcessReport(report.id, 'approve', true)}
                        className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                        通过并下架
                      </button>
                      <button
                        onClick={() => handleProcessReport(report.id, 'approve', false)}
                        className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                        仅标记处理
                      </button>
                      <button
                        onClick={() => handleProcessReport(report.id, 'reject')}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700"
                      >
                        <XCircle className="w-4 h-4" />
                        驳回
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 用户详情弹窗 */}
      {showUserDetail && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* 弹窗头部 */}
            <div className="bg-purple-600 text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{selectedUser.phone}</h2>
                <div className="text-sm opacity-90 mt-1">
                  微信：{selectedUser.wechat_id} | 邀请码：{selectedUser.invite_code}
                </div>
              </div>
              <button
                onClick={handleCloseUserDetail}
                className="text-white hover:bg-white/20 rounded-lg p-2"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingUserDetail ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                  <div className="mt-4 text-gray-600">加载中...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 用户基本信息 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      基本信息
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">当前积分</div>
                        <div className="text-xl font-bold text-yellow-600">{selectedUser.points || 0}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">发布数量</div>
                        <div className="text-xl font-bold text-blue-600">{selectedUser.total_posts || 0}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">成交率</div>
                        <div className="text-xl font-bold text-green-600">{selectedUser.deal_rate || 0}%</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">账号状态</div>
                        <div className={`text-xl font-bold ${selectedUser.status === 1 ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedUser.status === 1 ? '正常' : '禁用'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                      注册时间：{new Date(selectedUser.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* 积分变动历史 */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-600" />
                      积分变动历史
                      <span className="text-sm font-normal text-gray-500">（最近50条）</span>
                    </h3>
                    {userPointHistory.length === 0 ? (
                      <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                        暂无积分变动记录
                      </div>
                    ) : (
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">时间</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">类型</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">变动</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">余额</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">说明</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {userPointHistory.map((record) => (
                                <tr key={record.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {new Date(record.created_at).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                      {getPointChangeTypeLabel(record.change_type)}
                                    </span>
                                  </td>
                                  <td className={`px-4 py-3 text-sm text-right font-semibold ${
                                    record.change_amount > 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {record.change_amount > 0 ? '+' : ''}{record.change_amount}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right font-medium">
                                    {record.balance_after}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {record.description || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 用户所有交易信息 */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      所有交易信息
                      <span className="text-sm font-normal text-gray-500">（共{userPosts.length}条）</span>
                    </h3>
                    {userPosts.length === 0 ? (
                      <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                        该用户暂未发布任何信息
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {userPosts.map((post) => (
                          <div key={post.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold">{post.title}</h4>
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    post.status === 1 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {post.status === 1 ? '上架中' : '已下架'}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <div>价格：¥{post.price}</div>
                                  <div>查看：{post.view_count}/{post.view_limit} 次</div>
                                  {post.description && (
                                    <div className="text-gray-500 line-clamp-2">{post.description}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-400 mt-2 pt-2 border-t">
                              <div>发布时间：{new Date(post.created_at).toLocaleString()}</div>
                              {post.updated_at && post.updated_at !== post.created_at && (
                                <div>更新时间：{new Date(post.updated_at).toLocaleString()}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="border-t p-4 bg-gray-50 flex justify-end">
              <button
                onClick={handleCloseUserDetail}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
