const _vfos = ['A', 'B'];
const _bands = ['80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m'];
const _bandFreqs = [3520000, 7020000, 10120000, 14020000, 18068000, 21020000, 24890000, 28020000];

class Transceiver {
  constructor() {
    this._rxVfo = 0;
    this._txVfo = 0; // TODO split operation
    this._band = 1;
    this._freq = [];
    _bandFreqs.forEach(freq => {
      const band = _bandFreqs.indexOf(freq);
      if (!(band in this._freq)) {
        this._freq[band] = [];
      }
      for (const vfo in _vfos) {
        this._freq[band][vfo] = freq;
      }
    });
    console.log(`freqs=${this._freq}`);
    this._wpm = 28;

    this._listeners = {};
    this._d("tcvr-init", "done");
  }

  switchPower() {
    if (this._port) {
      this._d("disconnect", true)
      this.removeEventListenersFor(this._port.constructor.id)
      this._port.disconnect()
      this._port = undefined
    } else {
      console.log('connect')
      let connectorId = SmartceiverWebUSBConnector.id
      let connector = tcvrConnectors.get(connectorId)
      connector.connect(this, (port) => {
        this._port = port
        // reset tcvr configuration
        this.freq = this._freq[this._band][this._rxVfo]
        this.wpm = this._wpm
      });
    }
  }

  whenConnected(proceed) {
    if (this._port) {
      proceed()
    }
  }

  get allBands() {
    return _bands
  }

  get allModes() {
    return _modes
  }

  get allVfos() {
    return _vfos
  }

  get band() {
    return this._band
  }
  set band(band) {
    this.whenConnected(() => {
      this._d("band", band)
      if (band in _bands) {
        this._band = band
        this.freq = this._freq[this._band][this._rxVfo] // call setter  
      }
    })
  }

  get freq() {
    return this._freq[this._band][this._rxVfo]
  }
  set freq(freq) {
    this.whenConnected(() => {
      this._freq[this._band][this._rxVfo] = freq
      this._d("freq", freq)
      this.dispatchEvent(new TcvrEvent(EventType.freq, freq))
    })
  }

  get wpm() {
    return this._wpm
  }
  set wpm(wpm) {
    this.whenConnected(() => {
      if (wpm < 12 || wpm > 40) {
        return
      }
      this._wpm = wpm
      this._d("wpm", wpm)
      this.dispatchEvent(new TcvrEvent(EventType.wpm, wpm))
    })
  }

  addEventListener(type, owner, callback) {
    if (!(type in this._listeners)) {
      this._listeners[type] = []
    }
    this._listeners[type].push(new EventListener(owner, callback))
    this._d("addEventListener: " + type + ", for " + owner + ", callbacks:", this._listeners[type].length)
  }

  removeEventListenersFor(owner) {
    for (let type in this._listeners) {
      let stack = this._listeners[type]
      for (let i = 0, l = stack.length; i < l; i++) {
        if (stack[i].owner == owner) {
          this._d("removeEventListener for " + owner + " type", type)
          stack.splice(i, 1)
        }
      }
    }
  }

  dispatchEvent(event) {
    let stack = this._listeners[event.type]
    stack.forEach(listenner => listenner.callback.call(this, event))
    return true //!event.defaultPrevented;
  }

  _d(what, value) {
    console.log(what + "=" + value)
  }
}

class TcvrEvent {
  constructor(type, value) {
    this._type = type
    this._value = value
  }
  get type() { return this._type }
  get value() { return this._value }
}

class EventListener {
  constructor(owner, callback) {
    this._owner = owner
    this._callback = callback
  }
  get owner() { return this._owner }
  get callback() { return this._callback }
}

const EventType = Object.freeze({freq: 1, wpm: 2, mode: 3, vfo: 4, filter: 5, preamp: 6, attn: 7, keyDit: 8, keyDah: 9})

class ConnectorRegister {
  constructor() { this._reg = {} }

  register(connector) { this._reg[connector.constructor.id] = connector }
  get(id) { return this._reg[id] }

  get all() { return Object.values(this._reg) }
}

var tcvrConnectors = new ConnectorRegister();
