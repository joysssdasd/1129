const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    selectedAmount: 50,
    customAmount: '',
    isCustom: false,
    screenshot: '',
    loading: false,
    paymentQRCodes: {},
    rechargeOptions: [
      { amount: 50, points: 55, bonus: 5 },
      { amount: 100, points: 115, bonus: 15 },
      { amount: 300, points: 370, bonus: 70 },
      { amount: 500, points: 650, bonus: 150 }
    ]
  },

  onLoad() {
    this.checkLogin()
    this.loadPaymentQRCodes()
  },

  onShow() {
    this.refreshUserInfo()
  },

  // 检查登录
  checkLogin() {
    if (!app.checkLogin()) {
      wx.redirectTo({
        url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/recharge/recharge')
      })
      return
    }
    this.setData({ userInfo: app.globalData.userInfo })
  },

  // 刷新用户信息
  async refreshUserInfo() {
    const userInfo = await app.refreshUserInfo()
    if (userInfo) {
      this.setData({ userInfo })
    }
  },

  // 加载收款二维码
  async loadPaymentQRCodes() {
    try {
      const res = await app.request({
        url: '/rest/v1/payment_qrcodes?status=eq.active&order=created_at.desc'
      })
      
      if (res.data) {
        const wechat = res.data.find(q => q.payment_type === 'wechat')
        const alipay = res.data.find(q => q.payment_type === 'alipay')
        this.setData({
          paymentQRCodes: {
            wechat: wechat?.qr_code_url,
            alipay: alipay?.qr_code_url
          }
        })
      }
    } catch (e) {
      console.error('加载收款二维码失败:', e)
    }
  },

  // 选择预设金额
  selectAmount(e) {
    const amount = parseInt(e.currentTarget.dataset.amount)
    this.setData({
      selectedAmount: amount,
      isCustom: false,
      customAmount: ''
    })
  },

  // 输入自定义金额
  onCustomInput(e) {
    const value = e.detail.value.replace(/\D/g, '').slice(0, 6)
    this.setData({
      customAmount: value,
      isCustom: !!value,
      selectedAmount: value ? 0 : 50
    })
  },

  // 计算获得积分
  getPoints() {
    if (this.data.isCustom) {
      return parseInt(this.data.customAmount) || 0
    }
    const option = this.data.rechargeOptions.find(o => o.amount === this.data.selectedAmount)
    return option?.points || 0
  },

  // 预览二维码
  previewQRCode(e) {
    const type = e.currentTarget.dataset.type
    const url = this.data.paymentQRCodes[type]
    if (url) {
      wx.previewImage({
        urls: [url],
        current: url
      })
    }
  },

  // 选择截图
  chooseScreenshot() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        // 转为 base64
        wx.getFileSystemManager().readFile({
          filePath: tempFilePath,
          encoding: 'base64',
          success: (data) => {
            this.setData({
              screenshot: 'data:image/jpeg;base64,' + data.data
            })
          }
        })
      }
    })
  },

  // 提交充值申请
  async submitRecharge() {
    const { userInfo, selectedAmount, customAmount, isCustom, screenshot, loading } = this.data
    
    if (loading) return
    
    // 验证金额
    let amount, points
    if (isCustom) {
      amount = parseInt(customAmount)
      if (!amount || amount < 1) {
        util.showToast('请输入有效金额')
        return
      }
      points = amount
    } else {
      amount = selectedAmount
      const option = this.data.rechargeOptions.find(o => o.amount === amount)
      points = option?.points || 0
    }
    
    if (!screenshot) {
      util.showToast('请上传付款截图')
      return
    }

    this.setData({ loading: true })

    try {
      util.showLoading('提交中...')
      
      const res = await app.callFunction('recharge-request', {
        user_id: userInfo.id,
        amount: amount,
        points: points,
        is_custom: isCustom,
        screenshot_data: screenshot
      })
      
      util.hideLoading()
      
      if (res.data) {
        wx.showModal({
          title: '提交成功',
          content: '充值申请已提交，请等待管理员审核',
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
      } else {
        util.showToast(res.error?.message || '提交失败')
      }
    } catch (e) {
      util.hideLoading()
      util.showToast(e.error?.message || '提交失败')
    }
    
    this.setData({ loading: false })
  }
})
