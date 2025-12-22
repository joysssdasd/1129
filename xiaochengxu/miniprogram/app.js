App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    supabaseUrl: 'https://hntiihuxqlklpiyqmlob.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudGlpaHV4cWxrbHBpeXFtbG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTE1ODksImV4cCI6MjA3OTU2NzU4OX0.yh4FiKZPUPR-G1LormpZuKGZIaF7eSRkDbZslvBJzhc'
  },

  onLaunch() {
    // 检查本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
      this.globalData.isLoggedIn = true
    }
  },

  // 检查登录状态
  checkLogin() {
    return this.globalData.isLoggedIn && this.globalData.userInfo
  },

  // 设置用户信息
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
    this.globalData.isLoggedIn = true
    wx.setStorageSync('userInfo', userInfo)
  },

  // 清除用户信息
  clearUserInfo() {
    this.globalData.userInfo = null
    this.globalData.isLoggedIn = false
    wx.removeStorageSync('userInfo')
  },

  // 刷新用户信息
  async refreshUserInfo() {
    if (!this.globalData.userInfo) return null
    
    try {
      const res = await this.request({
        url: `/rest/v1/users?id=eq.${this.globalData.userInfo.id}`,
        method: 'GET'
      })
      
      if (res.data && res.data.length > 0) {
        this.setUserInfo(res.data[0])
        return res.data[0]
      }
    } catch (e) {
      console.error('刷新用户信息失败:', e)
    }
    return null
  },

  // 封装请求方法
  request(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.supabaseUrl + options.url,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'Content-Type': 'application/json',
          'apikey': this.globalData.supabaseKey,
          'Authorization': `Bearer ${this.globalData.supabaseKey}`,
          ...options.header
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res)
          } else {
            reject(res)
          }
        },
        fail: reject
      })
    })
  },

  // 调用 Edge Function
  callFunction(functionName, data) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.supabaseUrl}/functions/v1/${functionName}`,
        method: 'POST',
        data: data,
        header: {
          'Content-Type': 'application/json',
          'apikey': this.globalData.supabaseKey,
          'Authorization': `Bearer ${this.globalData.supabaseKey}`
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            reject(res.data)
          }
        },
        fail: reject
      })
    })
  }
})
