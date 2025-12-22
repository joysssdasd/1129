const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    posts: [],
    currentType: 0,
    searchKeyword: '',
    loading: false,
    refreshing: false,
    hasMore: true,
    page: 0,
    pageSize: 20,
    announcement: ''
  },

  onLoad() {
    this.loadAnnouncement()
    this.loadPosts()
  },

  onShow() {
    // 每次显示时刷新数据
    if (this.data.posts.length > 0) {
      this.loadPosts(true)
    }
  },

  // 加载公告
  async loadAnnouncement() {
    try {
      const res = await app.request({
        url: '/rest/v1/announcements?is_active=eq.true&order=priority.desc&limit=1'
      })
      if (res.data && res.data.length > 0) {
        this.setData({ announcement: res.data[0].content })
      }
    } catch (e) {
      console.error('加载公告失败:', e)
    }
  },

  // 加载帖子列表
  async loadPosts(refresh = false) {
    if (this.data.loading) return

    const page = refresh ? 0 : this.data.page
    
    this.setData({ loading: true })

    try {
      let url = `/rest/v1/posts?status=eq.1&order=created_at.desc&limit=${this.data.pageSize}&offset=${page * this.data.pageSize}`
      
      // 类型筛选
      if (this.data.currentType > 0) {
        url += `&trade_type=eq.${this.data.currentType}`
      }
      
      // 关键词搜索
      if (this.data.searchKeyword) {
        url += `&or=(title.ilike.*${this.data.searchKeyword}*,keywords.ilike.*${this.data.searchKeyword}*)`
      }

      const res = await app.request({ url })
      
      const posts = (res.data || []).map(post => ({
        ...post,
        typeLabel: util.getTradeTypeLabel(post.trade_type),
        typeClass: util.getTradeTypeClass(post.trade_type),
        keywordList: post.keywords ? post.keywords.split(',').slice(0, 3) : [],
        remainingViews: Math.max(0, (post.view_limit || 10) - (post.view_count || 0)),
        timeAgo: this.getTimeAgo(post.created_at)
      }))

      this.setData({
        posts: refresh ? posts : [...this.data.posts, ...posts],
        page: page + 1,
        hasMore: posts.length === this.data.pageSize,
        loading: false,
        refreshing: false
      })
    } catch (e) {
      console.error('加载帖子失败:', e)
      util.showToast('加载失败')
      this.setData({ loading: false, refreshing: false })
    }
  },

  // 计算时间差
  getTimeAgo(dateStr) {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 30) return `${days}天前`
    return util.formatDate(dateStr)
  },

  // 下拉刷新
  onRefresh() {
    this.setData({ refreshing: true })
    this.loadPosts(true)
  },

  // 加载更多
  onLoadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts()
    }
  },

  // 筛选类型变化
  onFilterChange(e) {
    const type = parseInt(e.currentTarget.dataset.type)
    this.setData({ currentType: type, posts: [], page: 0, hasMore: true })
    this.loadPosts(true)
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  // 执行搜索
  onSearch() {
    this.setData({ posts: [], page: 0, hasMore: true })
    this.loadPosts(true)
  },

  // 跳转详情
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    })
  }
})
