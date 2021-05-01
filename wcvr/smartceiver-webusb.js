
const _encoder = new TextEncoder()
const _decoder = new TextDecoder()

class SmartceiverWebUSBConnector {

  constructor(deviceFilters = [
			{ 'vendorId': 0x2341, 'productId': 0x8036 },
			{ 'vendorId': 0x2341, 'productId': 0x8037 },
			{ 'vendorId': 0x2886, 'productId': 0x802F }, // Seeed XIAO M0
			{ 'vendorId': 0xcafe, 'productId': 0x4011 }, // TinyUSB on RPi Pico
		],
	) {
		this._deviceFilters = deviceFilters
	}

  static get id() { return 'smartceiver-webusb'; }
  static get name() { return 'SmartCeiver standalone WebUSB'; }
  static get capabilities() { return []; }

  connect(tcvr, successCallback) {
    // this.requestPort()
    navigator.usb.requestDevice({ 'filters': this._deviceFilters }).then(device => {
      console.log('Connecting to ' + device.productName)
      this._connectDevice(device).then(port => {
        console.log('Connected ' + device.productName)
        this._bindCommands(tcvr, port)
        successCallback(port);
      }, error => {
         console.log('Connection error (2): ' + error);
      });
    }).catch(error => {
      console.error('Connection error (1): ' + error);
    });
  }

  _connectDevice(device) {
    let port = new SmartceiverWebUSBPort(device)
    return port._open().then(() => port)
  };

  _bindCommands(tcvr, port) {
    port.receive = data => {
      console.log('rcvd: ' + data)
      if (data.includes('TP1;')) {
        tcvr.fire(new TcvrEvent(EventType.ptt, true));
      } else if (data.includes('TP0;')) {
        tcvr.fire(new TcvrEvent(EventType.ptt, false));
      }
    }
    
    tcvr.bind(EventType.keyDit, this.constructor.id, event => port.send(".;"))
    tcvr.bind(EventType.keyDah, this.constructor.id, event => port.send("-;"))
    // tcvr.bind(EventType.mode, this.constructor.id, event => port.send("MD" + (event.value + 1) + ";"))
    tcvr.bind(EventType.freq, this.constructor.id, event => {
      let freq = event.value
      let data = "FA" // + _vfos[this._rxVfo]; // TODO split
      data += "000"
      if (freq < 10000000) { // <10MHz
          data += "0"
      }
      data += freq
      port.send(data + ";")
    })
    tcvr.bind(EventType.wpm, this.constructor.id, event => port.send("KS0" + event.value + ";"))
    tcvr.bind(EventType.filter, this.constructor.id, event => {
      // console.log('bandWidth=' + bandWidth)
      // TODO this.player.setFilter(tcvr.sidetoneFreq, event.value)
      port.send((event.value.bandwidth < 1000 ? "RW0" : "RW") + event.value.bandwidth + ";")
    })
    tcvr.bind(EventType.preamp, this.constructor.id, event => port.send("PA" + (event.value ? "1" : "0") + ";"))
    tcvr.bind(EventType.attn, this.constructor.id, event => port.send("RA" + (event.value ? "1" : "0") + ";"))
    tcvr.bind(EventType.tune, this.constructor.id, event => port.send("TT" + (event.value ? "1" : "0") + ";"))
  }
}

class SmartceiverWebUSBPort {
// 	_interfaceNumber = 2  // original interface number of WebUSB Arduino demo
// 	_endpointIn = 5       // original in endpoint ID of WebUSB Arduino demo
// 	_endpointOut = 4      // original out endpoint ID of WebUSB Arduino demo
	_interfaceNumber = 0  // TinyUSB
	_endpointIn = 0       // TinyUSB
	_endpointOut = 0      // TinyUSB

	constructor(device, receiveSeparator = '\n', sendSeparator = '\n') {
    this._device = device;
		this._receiveSeparator = receiveSeparator
		this._sendSeparator = sendSeparator
		// this._sendSeparator = _encoder.encode(sendSeparator)
		this._receiveBuffer = ''
  }

  _open() {
    return this._device.open()
      .then(() => {
        if (this._device.configuration === null) {
          return this._device.selectConfiguration(1)
        }
			})
			.then(() => {
				const configurationInterfaces = this._device.configuration.interfaces
				configurationInterfaces.forEach(element => {
					element.alternates.forEach(elementalt => {
						if (elementalt.interfaceClass === 0xff) {
							this._interfaceNumber = element.interfaceNumber
							elementalt.endpoints.forEach(elementendpoint => {
								if (elementendpoint.direction === "out") {
									this._endpointOut = elementendpoint.endpointNumber
								}
								if (elementendpoint.direction === "in") {
									this._endpointIn = elementendpoint.endpointNumber
								}
							})
						}
					})
				})
			})
      .then(() => this._device.claimInterface(this._interfaceNumber))
			.then(() => this._device.selectAlternateInterface(this._interfaceNumber, 0))
      .then(() => this._device.controlTransferOut({
        'requestType': 'class',
        'recipient': 'interface',
        'request': 0x22,
        'value': 0x01,
        'index': this._interfaceNumber
      }))
      .then(() => this._readLoop())
  }

	_readLoop() {
	  this._device.transferIn(this._endpointIn, 64).then(result => {
	    this._handleReceived(_decoder.decode(result.data))
	    this._readLoop()
	  }, error => this.receiveError(error))
	}

	async disconnect() {
		if (!this._device) return

		await this._device.controlTransferOut({
			'requestType': 'class',
			'recipient': 'interface',
			'request': 0x22,
			'value': 0x00,
			'index': this._interfaceNumber
		})
		console.debug('USB close()')
		await this._device.close()
		this._device = null
	}

	_handleReceived(data) {
		for (const c of data) {
			if (c === this._receiveSeparator) {
				const cmd = this._receiveBuffer.trim()
				this._receiveBuffer = ''
				if (cmd)
					this.receive(cmd)
			} else {
				this._receiveBuffer += c
			}
		}
	}

	get connected() {
		return this._device != null
	}

	receive(data) {
		// callback
	}

	receiveError(error) {
		console.error('USB receive error:', error)
	}
	
	getDeviceName() {
		return `${this._device.productName} (${this._device.manufacturerName})`
	}

	async send(data) {
		console.debug(`USB <= ${data}`)
		if (this.connected) {
			const bytes = typeof data === 'string' ? _encoder.encode(`${data}${this._sendSeparator}`) : data
			await this._device.transferOut(this._endpointOut, bytes)
			return true
		}
		console.error(`USB: data not sent ${data}`)
		return false
	}
}

tcvrConnectors.register(new SmartceiverWebUSBConnector());
