const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    post: null,
    loading: true,
    showContact: false,
    contactInfo: null,
    viewing: false,
    showRiskModal: false,
    showReportModal: false,
    reportType: '',
    reportDesc: ''
  },

  onLoad(options) {
    if (options.id) {
      this.postId = options.id
      this.loadPost()
    }
  },

  // 加载帖子详情
  async loadPost() {
    try {
      const res = await app.request({
        url: `/rest/v1/posts?id=eq.${this.postId}`
      })
      
      if (res.data && res.data.length > 0) {
        const post = res.data[0]
        this.setData({
          post: {
            ...post,
            typeLabel: util.getTradeTypeLabel(post.trade_type),
            typeClass: util.getTradeTypeClass(post.trade_type),
            keywordList: post.keywords ? post.keywords.split(',') : [],
            remainingViews: Math.max(0, (post.view_limit || 10) - (post.view_count || 0)),
            createdAt: util.formatTime(post.created_at),
            expireAt: util.formatDate(post.expire_at)
          },
          loading: false
        })
      } else {
        util.showToast('帖子不存在')
        setTimeout(() => wx.navigateBack(), 1500)
      }
    } catch (e) {
      util.showToast('加载失败')
      this.setData({ loading: false })
    }
  },

  // 查看联系方式
  onViewContact() {
    if (!app.checkLogin()) {
      wx.navigateTo({
        url: `/pages/login/login?redirect=${encodeURIComponent('/pages/detail/detail?id=' + this.postId)}`
      })
      return
    }

    // 显示风险提示
    this.setData({ showRiskModal: true })
  },

  // 确认查看联系方式
  async confirmViewContact() {
    this.setData({ showRiskModal: false, viewing: true })

    try {
      const res = await app.callFunction('view-contact', {
        user_id: app.globalData.userInfo.id,
        post_id: this.postId
      })

      if (res.data) {
        // 优先使用 wechat_id，其次 contact_info
        const contactInfo = res.data.wechat_id || res.data.contact_info || ''
        
        this.setData({
          showContact: true,
          contactInfo: contactInfo
        })
        
        // 自动复制联系方式到剪贴板
        if (contactInfo && contactInfo !== 'null' && contactInfo !== '') {
          wx.setClipboardData({
            data: contactInfo,
            success: () => {
              const message = res.data.already_viewed ? '联系方式已复制（无需再次扣费）' : '联系方式已复制，已扣除1积分'
              util.showToast(message, 'success')
            },
            fail: () => {
              util.showToast('查看成功')
            }
          })
        } else {
          util.showToast('该用户未设置联系方式')
        }
        
        // 刷新用户积分
        app.refreshUserInfo()
        
        // 刷新帖子信息
        this.loadPost()
      } else {
        util.showToast(res.error?.message || '查看失败')
      }
    } catch (e) {
      console.error('查看联系方式失败:', e)
      util.showToast(e.error?.message || '查看失败')
    }

    this.setData({ viewing: false })
  },

  // 取消查看
  cancelViewContact() {
    this.setData({ showRiskModal: false })
  },

  // 复制联系方式
  copyContact() {
    const contactInfo = this.data.contactInfo
    if (contactInfo && contactInfo !== 'null' && contactInfo !== '') {
      wx.setClipboardData({
        data: contactInfo,
        success: () => {
          util.showToast('已复制微信号', 'success')
        },
        fail: (err) => {
          console.error('复制失败:', err)
          util.showToast('复制失败')
        }
      })
    } else {
      util.showToast('该用户未设置微信号')
    }
  },

  // 举报
  onReport() {
    if (!app.checkLogin()) {
      util.showToast('请先登录')
      return
    }
    this.setData({ showReportModal: true })
  },

  // 选择举报类型
  selectReportType(e) {
    this.setData({ reportType: e.currentTarget.dataset.type })
  },

  // 举报描述输入
  onReportDescInput(e) {
    this.setData({ reportDesc: e.detail.value })
  },

  // 提交举报
  async submitReport() {
    const { reportType, reportDesc } = this.data
    
    if (!reportType) {
      util.showToast('请选择举报类型')
      return
    }

    try {
      util.showLoading('提交中...')
      
      await app.request({
        url: '/rest/v1/reports',
        method: 'POST',
        data: {
          post_id: this.postId,
          reporter_id: app.globalData.userInfo.id,
          report_type: reportType,
          description: reportDesc
        }
      })
      
      util.hideLoading()
      util.showToast('举报已提交', 'success')
      this.setData({ showReportModal: false, reportType: '', reportDesc: '' })
    } catch (e) {
      util.hideLoading()
      util.showToast('提交失败')
    }
  },

  // 关闭举报弹窗
  closeReportModal() {
    this.setData({ showReportModal: false })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: this.data.post?.title || '牛牛基地 - 交易信息',
      path: `/pages/detail/detail?id=${this.postId}`
    }
  }
})
