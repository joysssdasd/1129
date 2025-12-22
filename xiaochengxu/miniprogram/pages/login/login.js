const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    loading: false
  },

  onLoad(options) {
    if (options.redirect) {
      this.redirectUrl = decodeURIComponent(options.redirect)
    }
  },

  // 微信一键登录 - 获取手机号授权
  async handleWechatLogin(e) {
    if (this.data.loading) return
    
    // 检查是否授权成功
    if (!e.detail.code) {
      if (e.detail.errMsg && e.detail.errMsg.includes('deny')) {
        util.showToast('需要授权手机号才能登录')
      }
      return
    }

    this.setData({ loading: true })

    try {
      util.showLoading('登录中...')
      
      // 调用后端微信一键登录接口
      const res = await app.callFunction('wechat-quick-login', {
        code: e.detail.code  // 手机号授权码
      })
      
      util.hideLoading()
      
      if (res.data && res.data.user) {
        // 登录成功
        app.setUserInfo(res.data.user)
        
        const message = res.data.isNewUser ? '注册成功，赠送100积分！' : '登录成功'
        util.showToast(message, 'success')
        
        setTimeout(() => {
          if (this.redirectUrl) {
            wx.redirectTo({ url: this.redirectUrl })
          } else {
            wx.switchTab({ url: '/pages/index/index' })
          }
        }, 1500)
      } else {
        util.showToast(res.error?.message || '登录失败')
      }
    } catch (e) {
      util.hideLoading()
      console.error('微信登录失败:', e)
      util.showToast(e.error?.message || '微信登录失败')
    }
    
    this.setData({ loading: false })
  },

  // 查看协议
  viewAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' })
  }
})
