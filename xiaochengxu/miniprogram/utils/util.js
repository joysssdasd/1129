// 格式化时间
const formatTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hour = d.getHours()
  const minute = d.getMinutes()

  return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hour)}:${padZero(minute)}`
}

const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()

  return `${year}-${padZero(month)}-${padZero(day)}`
}

const formatDateTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hour = d.getHours()
  const minute = d.getMinutes()
  const second = d.getSeconds()

  return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hour)}:${padZero(minute)}:${padZero(second)}`
}

const padZero = (n) => {
  return n < 10 ? '0' + n : n
}

// 获取交易类型标签
const getTradeTypeLabel = (type) => {
  const labels = {
    1: '求购',
    2: '出售',
    3: '做多',
    4: '做空'
  }
  return labels[type] || '未知'
}

// 获取交易类型样式类
const getTradeTypeClass = (type) => {
  const classes = {
    1: 'tag-buy',
    2: 'tag-sell',
    3: 'tag-long',
    4: 'tag-short'
  }
  return classes[type] || ''
}

// 显示提示
const showToast = (title, icon = 'none') => {
  wx.showToast({
    title,
    icon,
    duration: 2000
  })
}

// 显示加载
const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title,
    mask: true
  })
}

// 隐藏加载
const hideLoading = () => {
  wx.hideLoading()
}

// 显示确认框
const showModal = (title, content) => {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm)
      }
    })
  })
}

// 检查手机号格式
const isValidPhone = (phone) => {
  return /^1[3-9]\d{9}$/.test(phone)
}

// 计算剩余天数
const getRemainingDays = (expireAt) => {
  if (!expireAt) return 0
  const now = new Date()
  const expire = new Date(expireAt)
  const diff = expire - now
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

module.exports = {
  formatTime,
  formatDate,
  formatDateTime,
  padZero,
  getTradeTypeLabel,
  getTradeTypeClass,
  showToast,
  showLoading,
  hideLoading,
  showModal,
  isValidPhone,
  getRemainingDays
}
