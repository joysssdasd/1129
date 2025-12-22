Component({
  properties: {
    type: {
      type: String,
      value: 'primary' // primary, secondary, success, warning, danger, ghost, text, wechat, gradient
    },
    size: {
      type: String,
      value: 'medium' // large, medium, small, mini
    },
    icon: {
      type: String,
      value: ''
    },
    loading: {
      type: Boolean,
      value: false
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    handleTap() {
      if (!this.data.disabled && !this.data.loading) {
        this.triggerEvent('tap')
      }
    }
  }
})
