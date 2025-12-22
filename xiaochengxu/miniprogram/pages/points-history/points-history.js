const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    transactions: [],
    loading: false,
    hasMore: true,
    page: 0,
    pageSize: 20
  },

  onLoad() {
    this.checkLogin()
  },

  onShow() {
    if (app.checkLogin()) {
      this.refreshUserInfo()
      this.loadTransactions(true)
    }
  },

  // 检查登录
  checkLogin() {
    if (!app.checkLogin()) {
      wx.redirectTo({
        url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/points-history/points-history')
      })
    }
  },

  // 刷新用户信息
  async refreshUserInfo() {
    const userInfo = await app.refreshUserInfo()
    if (userInfo) {
      this.setData({ userInfo })
    } else {
      this.setData({ userInfo: app.globalData.userInfo })
    }
  },

  // 加载积分记录
  async loadTransactions(refresh = false) {
    if (this.data.loading) return
    if (!refresh && !this.data.hasMore) return

    const page = refresh ? 0 : this.data.page
    
    this.setData({ loading: true })

    try {
      const userId = app.globalData.userInfo?.id
      const url = `/rest/v1/point_transactions?user_id=eq.${userId}&order=created_at.desc&limit=${this.data.pageSize}&offset=${page * this.data.pageSize}`

      const res = await app.request({ url })
      
      const transactions = (res.data || []).map(tx => ({
        ...tx,
        isPositive: tx.change_amount > 0,
        amountText: tx.change_amount > 0 ? `+${tx.change_amount}` : `${tx.change_amount}`,
        createTime: util.formatDateTime(tx.created_at)
      }))

      this.setData({
        transactions: refresh ? transactions : [...this.data.transactions, ...transactions],
        page: page + 1,
        hasMore: transactions.length === this.data.pageSize,
        loading: false
      })
    } catch (e) {
      console.error('加载积分记录失败:', e)
      util.showToast('加载失败')
      this.setData({ loading: false })
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadTransactions(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadTransactions()
    }
  }
})
