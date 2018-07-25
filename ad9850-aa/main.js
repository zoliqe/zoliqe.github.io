//import Chart from 'chart.bundle.min.js'

//                       6E400001 B5A3 F393 E0A9 E50E24DCCA9E
const mbitUartService = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase() //to send TO the microbit
const mbitUartRxCharacteristic = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase() //to send TO the microbit
const mbitUartTxCharacteristic = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase() //to receive data FROM the microbit
const connectButton = document.getElementById("connectButton")
//const freqButton = document.getElementById("freqButton")
const log = document.getElementById("log")
const freqInput = document.getElementById('freq')
//const values = []

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

// chart.canvas.parentNode.style.height = '300px'

function show(text) {
  log.innerHTML = text
}

function value(val) {
  show(`${freqInput.value}: ${val}`)
  let data = chart.data.datasets[0].data
  data.length >= 10 && data.shift()
  data.push(parseInt(val))
  //chart.data.datasets[0].data = values
  chart.update()
  // console.log(values)
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
    show(`Found:  ${device.name}`)
    return device.gatt.connect()
  }).then(server => {
    show('Connecting...')
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
    show('Ready!')
    connectButton.disabled = true
    setInterval(() => mbit.send('?'), 200)
  }).catch(error => console.log(error))
}

function freq(e) {
  mbit.send(`${freq.value}`)
}

connectButton.onclick = connectClicked
//freqButton.onclick = freqClicked
freqInput.onchange = freq
