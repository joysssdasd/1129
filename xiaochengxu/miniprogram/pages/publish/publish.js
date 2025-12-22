const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    tradeType: 2,
    title: '',
    keywords: '',
    price: '',
    extraInfo: '',
    viewLimit: 10,
    deliveryDays: '',
    loading: false,
    bannedKeywords: []
  },

  onLoad() {
    this.loadBannedKeywords()
  },

  onShow() {
    // 检查登录状态
    if (!app.checkLogin()) {
      wx.navigateTo({
        url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/publish/publish')
      })
    }
  },

  // 加载敏感词
  async loadBannedKeywords() {
    try {
      const res = await app.request({
        url: '/rest/v1/banned_keywords?select=keyword'
      })
      if (res.data) {
        this.setData({
          bannedKeywords: res.data.map(item => item.keyword)
        })
      }
    } catch (e) {
      console.error('加载敏感词失败:', e)
    }
  },

  // 选择交易类型
  selectTradeType(e) {
    this.setData({ tradeType: parseInt(e.currentTarget.dataset.type) })
  },

  // 输入处理
  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onKeywordsInput(e) {
    this.setData({ keywords: e.detail.value })
  },

  onPriceInput(e) {
    this.setData({ price: e.detail.value })
  },

  onExtraInfoInput(e) {
    this.setData({ extraInfo: e.detail.value })
  },

  onViewLimitChange(e) {
    this.setData({ viewLimit: parseInt(e.detail.value) })
  },

  onDeliveryDaysInput(e) {
    this.setData({ deliveryDays: e.detail.value })
  },

  // 检查敏感词
  checkBannedKeywords(text) {
    const { bannedKeywords } = this.data
    for (const keyword of bannedKeywords) {
      if (text.includes(keyword)) {
        return keyword
      }
    }
    return null
  },

  // 发布
  async handlePublish() {
    const { tradeType, title, keywords, price, extraInfo, viewLimit, deliveryDays, loading } = this.data

    if (loading) return

    // 验证
    if (!title.trim()) {
      util.showToast('请输入标题')
      return
    }

    if (!keywords.trim()) {
      util.showToast('请输入关键词')
      return
    }

    if (!price || parseFloat(price) <= 0) {
      util.showToast('请输入有效价格')
      return
    }

    // 做多做空需要交割天数
    if ((tradeType === 3 || tradeType === 4) && !deliveryDays) {
      util.showToast('请输入交割天数')
      return
    }

    // 检查敏感词
    const allText = `${title} ${keywords} ${extraInfo}`
    const bannedWord = this.checkBannedKeywords(allText)
    if (bannedWord) {
      util.showToast(`内容包含敏感词：${bannedWord}`)
      return
    }

    // 检查积分
    const user = app.globalData.userInfo
    const cost = viewLimit
    if (user.points < cost) {
      const confirm = await util.showModal('积分不足', `发布需要${cost}积分，当前积分${user.points}，是否去充值？`)
      if (confirm) {
        wx.navigateTo({ url: '/pages/recharge/recharge' })
      }
      return
    }

    this.setData({ loading: true })

    try {
      util.showLoading('发布中...')

      const postData = {
        user_id: user.id,
        title: title.trim(),
        keywords: keywords.trim(),
        price: parseFloat(price),
        trade_type: tradeType,
        extra_info: extraInfo.trim() || null,
        view_limit: viewLimit
      }

      if (tradeType === 3 || tradeType === 4) {
        postData.delivery_days = parseInt(deliveryDays)
      }

      const res = await app.callFunction('publish-post', postData)

      util.hideLoading()

      if (res.data) {
        util.showToast('发布成功', 'success')
        
        // 刷新用户信息
        app.refreshUserInfo()

        // 清空表单
        this.setData({
          title: '',
          keywords: '',
          price: '',
          extraInfo: '',
          viewLimit: 10,
          deliveryDays: ''
        })

        // 跳转到首页
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 1500)
      } else {
        util.showToast(res.error?.message || '发布失败')
      }
    } catch (e) {
      util.hideLoading()
      util.showToast(e.error?.message || '发布失败')
    }

    this.setData({ loading: false })
  }
})
