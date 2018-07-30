//import Chart from 'chart.bundle.min.js'

//                       6E400001 B5A3 F393 E0A9 E50E24DCCA9E
const mbitUartService = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase() //to send TO the microbit
const mbitUartRxCharacteristic = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase() //to send TO the microbit
const mbitUartTxCharacteristic = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase() //to receive data FROM the microbit
const connectButton = document.querySelector('#connectButton')
//const freqButton = document.getElementById("freqButton")
const logEl = document.querySelector('#log')
const freq = document.querySelector('#freq')
const reverse = document.querySelector('#reverse')
const canvas = document.querySelector('#graph')
const ctx = canvas.getContext('2d')

const count = 100
canvas.height = 500
canvas.width = count
const values = new Array(count)
values.fill(0)

/*
const chart = new Chart('chart', {
  type: 'line',
  data: {
    datasets: [{
      data: []
    }]
  },
  options: {
    animation: {
      duration: 0,
      easing: 'linear'
    },
    hover: {
      animationDuration: 0, // duration of animations when hovering an item
    },
    responsiveAnimationDuration: 0, // animation duration after a resize
    elements: {
      line: {
        tension: 0
      }
    },
    scales: {
      yAxes: [{
        type: 'logarithmic',
        ticks: {
          min: 0,
          max: 150,
        }
      }],
      xAxes: [{
        ticks: {
          min: 0,
          max: 20
        }
      }]
    }
  }
})
*/
// chart.canvas.parentNode.style.height = '300px'

function log(text) {
  logEl.innerHTML = text
}

function value(val) {
//  show(`${freqInput.value}: ${val}`)
//  let values = chart.data.datasets[0].data
  values.shift()
  values.push((getBaseLog(1.5, parseInt(val) + 1)) + 1)
  // chart.update()

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.globalAlpha = 1.0
  let v
  for (let i = 0; i < values.length; ++i) {
    v = values[i]
    let color = '150,0,0'
    if (v < 1.5) {
      color = '0,150,0'
    } else if (v < 3) {
      color = '204,208,41'
    }
    ctx.fillStyle = 'rgb(' + color + ')'
    ctx.fillRect(i, canvas.height, 1, -v*40)
  }
  reverse.innerHTML = v > 10 ? '>10' : v.toFixed(1)
}

function getBaseLog(x, y) {
  return Math.log(y) / Math.log(x);
}

const bluetoothSearchOptions = {
  filters: [{ namePrefix: "BBC micro:bit" }],
  optionalServices: [mbitUartService]
}

class MicroBitUART {
  constructor(rxCharacteristic, txCharacteristic) {
    this.rxCharacteristic = rxCharacteristic
    this.txCharacteristic = txCharacteristic
    this.decoder = new TextDecoder()
    this.encoder = new TextEncoder('utf-8')
    this.txCharacteristic.startNotifications().then(characteristic => {
      characteristic.addEventListener('characteristicvaluechanged', event => {
        let valueAsString = this.decoder.decode((event.target).value)
        this.valueChanged(valueAsString)
      })
    })
  }
  
  send(value) {
    let encoded = this.encoder.encode(`${value}\n`)
    this.rxCharacteristic.writeValue(encoded)
  }
  
  valueChanged(value) {
    console.log(value)
  }
}

let mbit = null

function connectClicked(e) {
  navigator.bluetooth.requestDevice(bluetoothSearchOptions).then(device => {
    log(`Found:  ${device.name}`)
    return device.gatt.connect()
  }).then(server => {
    log('Connecting...')
    return server.getPrimaryService(mbitUartService)
  }).then(service => {
    return Promise.all([service.getCharacteristic(mbitUartRxCharacteristic),
      service.getCharacteristic(mbitUartTxCharacteristic)])
  }).then(rxandtx => {
    let rx
    let tx
    [rx, tx] = rxandtx
    mbit = new MicroBitUART(rx, tx)
    mbit.valueChanged = val => value(val)
    log('Connected')
    connectButton.disabled = true
    knob.tune(knob.freq)
    knob.locked = false
    setInterval(() => mbit.send('?'), 200)
  }).catch(error => console.log(error))
}

connectButton.onclick = connectClicked
//freqButton.onclick = freqClicked
//freqInput.onchange = freq

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
      this.freq += this._fdelta
      this._fdelta = 0
      this.tune(this.freq)
    }
  }
  
  tune(freq) {
    console.log('tuned: ' + freq)
  }
}

let knob = new TuningKnob(document.querySelector('#knob'), 7050, 10)
knob.locked = true
knob.tune = (value) => {
  freq.innerHTML = value + ' kHz'
  mbit.send(value)
}

log('Ready')
