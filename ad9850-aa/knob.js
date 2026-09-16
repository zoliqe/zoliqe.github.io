class TuningKnob {
  constructor(knobElement, freq, step) {
    this.fast = true
    this.locked = false
    this.freq = freq
    this.step = step
    this._fdelta = 0
    this._startAngle = 0
    this._lastAngle = 0
    this._lastRotation = 0
    this.threshold = 2

    if (typeof knobElement == 'string') {
      this.knob = document.querySelector(knobElement)
    } else {
      this.knob = knobElement
    }
    
    this._centerX = this.knob.offsetLeft + (this.knob.offsetWidth / 2)
    this._centerY = this.knob.offsetTop + (this.knob.offsetHeight / 2)
    console.debug('startX=' + this._centerX + ', startY=' + this._centerY)

    this.knob.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches.item(0)
      this._startAngle = Math.atan2(touch.pageY - this._centerY, touch.pageX - this._centerX) * 180 / Math.PI
      console.debug("startAngle=" + this._startAngle)
    });
    this.knob.addEventListener('touchmove', e => this._rotateByTouch(e))
    this.knob.addEventListener('touchend', e => this._rotateByTouch(e))
  }
  
  _rotateByTouch(event) {
    const touch = event.changedTouches.item(0)
    event.preventDefault() // Turn off default event handling
  
    const currentAngle = Math.atan2(touch.pageY - this._centerY, touch.pageX - this._centerX) * 180 / Math.PI
    const rotation = this._lastAngle + (currentAngle - this._startAngle)
    if (Math.abs(rotation - this._lastRotation) > this.threshold) {
      this.rotateKnob(rotation)
    }
  
    if (event.type == 'touchend') {
      this._lastAngle = rotation
      this._fdelta = 0
    }
    return rotation
  }
  
  rotateKnob(rotation) {
    const delta = rotation - this._lastRotation
    this._lastRotation = rotation
    // console.log(transform);
    this.knob.style.transform = 'rotate(' + rotation + 'deg)'
  
    if (this.locked) {
      return
    }
    console.debug('delta', delta)
    this._fdelta += delta > 0 ? 1 : -1
    if (Math.abs(this._fdelta) >= this.step) {
      this.freq = this.tune(this.freq + this._fdelta)
      this._fdelta = 0
    }
  }
  
  tune(freq) {
    console.log('tuned: ' + freq)
    return freq
  }
}

