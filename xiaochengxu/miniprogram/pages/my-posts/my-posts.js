const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    posts: [],
    loading: false,
    refreshing: false,
    currentFilter: 'all' // all, active, inactive
  },

  onLoad() {
    this.checkLogin()
  },

  onShow() {
    if (app.checkLogin()) {
      this.loadPosts()
    }
  },

  // 检查登录
  checkLogin() {
    if (!app.checkLogin()) {
      wx.redirectTo({
        url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/my-posts/my-posts')
      })
    }
  },

  // 加载帖子
  async loadPosts() {
    if (this.data.loading) return
    
    this.setData({ loading: true })

    try {
      const userId = app.globalData.userInfo?.id
      let url = `/rest/v1/posts?user_id=eq.${userId}&order=created_at.desc`
      
      // 筛选
      if (this.data.currentFilter === 'active') {
        url += '&status=eq.1'
      } else if (this.data.currentFilter === 'inactive') {
        url += '&status=eq.0'
      }

      const res = await app.request({ url })
      
      const posts = (res.data || []).map(post => ({
        ...post,
        typeLabel: util.getTradeTypeLabel(post.trade_type),
        statusLabel: post.status === 1 ? '上架中' : '已下架',
        statusClass: post.status === 1 ? 'active' : 'inactive',
        remainingViews: Math.max(0, (post.view_limit || 10) - (post.view_count || 0)),
        createTime: util.formatDate(post.created_at)
      }))

      this.setData({
        posts,
        loading: false,
        refreshing: false
      })
    } catch (e) {
      console.error('加载帖子失败:', e)
      util.showToast('加载失败')
      this.setData({ loading: false, refreshing: false })
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadPosts().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 筛选切换
  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ currentFilter: filter, posts: [] })
    this.loadPosts()
  },

  // 查看详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    })
  },

  // 切换上下架状态
  async toggleStatus(e) {
    const post = e.currentTarget.dataset.post
    const { id, status, view_count, view_limit } = post
    
    let message = ''
    if (status === 1) {
      const remaining = view_limit - view_count
      message = remaining > 0 ? `确定下架？将返还${remaining}积分` : '确定下架？'
    } else {
      message = '确定上架？将扣除10积分'
    }

    wx.showModal({
      title: '提示',
      content: message,
      success: async (res) => {
        if (res.confirm) {
          try {
            util.showLoading('处理中...')
            
            const result = await app.callFunction('toggle-post-status', {
              user_id: app.globalData.userInfo?.id,
              post_id: id
            })
            
            util.hideLoading()
            
            if (result.data) {
              util.showToast(result.data.message || '操作成功', 'success')
              // 刷新用户信息和帖子列表
              app.refreshUserInfo()
              this.loadPosts()
            } else {
              util.showToast(result.error?.message || '操作失败')
            }
          } catch (e) {
            util.hideLoading()
            util.showToast(e.error?.message || '操作失败')
          }
        }
      }
    })
  },

  // 去发布
  goPublish() {
    wx.switchTab({
      url: '/pages/publish/publish'
    })
  },

  // 删除帖子
  deletePost(e) {
    const post = e.currentTarget.dataset.post
    
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除吗？',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            util.showLoading('删除中...')
            
            await app.request({
              url: `/rest/v1/posts?id=eq.${post.id}&user_id=eq.${app.globalData.userInfo?.id}`,
              method: 'DELETE'
            })
            
            util.hideLoading()
            util.showToast('删除成功', 'success')
            
            // 刷新列表
            this.loadPosts()
            app.refreshUserInfo()
          } catch (e) {
            util.hideLoading()
            util.showToast('删除失败')
          }
        }
      }
    })
  }
})
