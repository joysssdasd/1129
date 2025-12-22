Component({
  properties: {
    name: {
      type: String,
      value: ''
    },
    size: {
      type: Number,
      value: 48
    },
    color: {
      type: String,
      value: '#8E8E93'
    },
    animated: {
      type: Boolean,
      value: false
    }
  },
  data: {
    iconClass: ''
  },
  observers: {
    'name, animated': function(name, animated) {
      this.setData({
        iconClass: `icon-${name}${animated ? ' animated' : ''}`
      })
    }
  }
})
