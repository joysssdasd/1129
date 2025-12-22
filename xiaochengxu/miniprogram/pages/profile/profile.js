const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isLoggedIn: false
  },

  onLoad() {
  },

  onShow() {
    this.checkLoginStatus()
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({
        userInfo: userInfo,
        isLoggedIn: true
      })
      // 刷新用户信息
      this.refreshUserInfo()
    } else {
      this.setData({
        userInfo: null,
        isLoggedIn: false
      })
    }
  },

  // 刷新用户信息
  async refreshUserInfo() {
    const userInfo = await app.refreshUserInfo()
    if (userInfo) {
      this.setData({ userInfo })
    }
  },

  // 跳转登录
  goLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  // 跳转我的发布
  goMyPosts() {
    if (!this.data.isLoggedIn) {
      this.goLogin()
      return
    }
    wx.navigateTo({
      url: '/pages/my-posts/my-posts'
    })
  },

  // 跳转充值
  goRecharge() {
    if (!this.data.isLoggedIn) {
      this.goLogin()
      return
    }
    wx.navigateTo({
      url: '/pages/recharge/recharge'
    })
  },

  // 跳转积分记录
  goPointsHistory() {
    if (!this.data.isLoggedIn) {
      this.goLogin()
      return
    }
    wx.navigateTo({
      url: '/pages/points-history/points-history'
    })
  },

  // 复制邀请码
  copyInviteCode() {
    if (!this.data.userInfo?.invite_code) return
    
    wx.setClipboardData({
      data: this.data.userInfo.invite_code,
      success: () => {
        util.showToast('邀请码已复制', 'success')
      }
    })
  },

  // 联系客服
  contactService() {
    wx.showModal({
      title: '联系客服',
      content: '如有问题请联系客服微信：niuniujidi_kf',
      showCancel: false
    })
  },

  // 查看用户协议
  viewAgreement() {
    wx.navigateTo({
      url: '/pages/agreement/agreement'
    })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearUserInfo()
          this.setData({
            userInfo: null,
            isLoggedIn: false
          })
          util.showToast('已退出登录', 'success')
        }
      }
    })
  }
})
