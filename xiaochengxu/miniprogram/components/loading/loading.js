Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    type: {
      type: String,
      value: 'spinner' // spinner, dots, wave, ring
    },
    text: {
      type: String,
      value: ''
    },
    mask: {
      type: Boolean,
      value: true
    }
  }
})
