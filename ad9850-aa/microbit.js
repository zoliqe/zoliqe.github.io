//                       6E400001 B5A3 F393 E0A9 E50E24DCCA9E
const mbitUartService = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase() //to send TO the microbit
const mbitUartRxCharacteristic = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase() //to send TO the microbit
const mbitUartTxCharacteristic = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase() //to receive data FROM the microbit
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

function connectMicrobit(logFnc, connectCallback) {
  navigator.bluetooth.requestDevice(bluetoothSearchOptions).then(device => {
    logFnc(`Found:  ${device.name}`)
    return device.gatt.connect()
  }).then(server => {
    logFnc('Connecting...')
    return server.getPrimaryService(mbitUartService)
  }).then(service => {
    return Promise.all([service.getCharacteristic(mbitUartRxCharacteristic),
      service.getCharacteristic(mbitUartTxCharacteristic)])
  }).then(rxandtx => {
    let rx
    let tx
    [rx, tx] = rxandtx
    mbit = new MicroBitUART(rx, tx)
    logFnc('Connected')
    connectCallback(mbit)
  }).catch(error => console.log(error))
}
