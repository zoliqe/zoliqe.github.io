const _vfos = ['A', 'B']
// const _bands = ['3.5', '7', '10.1', '14', '18', '21']
const _bands = [3520000, 7030000, 10118000, 14020000, 18068000, 21020000]
const _modes = ['LSB', 'USB', 'CW', 'CWR'] // order copies mode code for MDn cmd
const _filters = [50, 100, 300, 600, 1800, 2400]
const _narrowFilter = 2
const _wideFilter = 5
// const _narrowFilters = [1800, 1800, 100, 100] // in _modes order
// const _wideFilters =   [2700, 2700, 1000, 1000] // in _modes order
const _sidetoneFreq = 600
const _sidetoneLevel = 0.2

class Transceiver {
  constructor() {
    this._rxVfo = 0
    this._txVfo = 0 // TODO split operation
    this._band = 1
    this._mode = 2
    this._filter = 3
    this._freq = []
    _bands.forEach(freq => {
      let band = _bands.indexOf(freq)
      if (!(band in this._freq)) {
        this._freq[band] = []
      }
      for (const mode in _modes) {
        if (!(mode in this._freq[band])) {
          this._freq[band][mode] = []
        }
        for (const vfo in _vfos) {
          this._freq[band][mode][vfo] = freq
        }
      }
    })
    console.log(`freqs=${this._freq}`)
    this._wpm = 28
    this._txEnabled = true
    this._txKeyed = false
    this._autoSpace = true
    // this._narrow = false
    this._preamp = false
    this._attn = false
    // this._buildBFO();

    this._connectorId = typeof selectedConnector === 'undefined' ? SmartceiverWebUSBConnector.id : selectedConnector
    console.log('used connector: ' + this._connectorId)
    
    this._listeners = {}
    // this.bind(EventType.keyDit, 'tcvr', event => this._tone(1))
    // this.bind(EventType.keyDah, 'tcvr', event => this._tone(3))
    this._d("tcvr-init", "done")
  }

  switchPower(state) {
    if ( ! state && this._port) {
      this._d("disconnect", true)
      this.unbind(this._connectorId)
      this._port.disconnect()
      this._port = null
      this._disconnectRemoddle()
    } else if (state) {
      this._d('connect')
      let connector = tcvrConnectors.get(this._connectorId)
      // this._connectRemoddle(connector)
      connector.connect(this, (port) => {
        this._port = port
        // reset tcvr configuration
        this.freq = this._freq[this._band][this._mode][this._rxVfo]
        this.wpm = this._wpm
        this.txEnabled = this._txEnabled
        this.autoSpace = this._autoSpace
        this.txKeyed = this._txKeyed
        // this.narrow = this._narrow
        this.filter = this._filter
        this.preamp = this._preamp
        this.attn = this._attn
      })
    }
  }

  _connectRemoddle(connector) {
    if ( ! connector.constructor.capabilities.includes(Remoddle.id)) {
      return
    }
    this._disconnectRemoddle() // remove previous instance

    new Remoddle(this).connect(remoddle => {
      this._remoddle = remoddle
      remoddle.wpm = this.wpm // sync with current wpm state
    })
  }

  _disconnectRemoddle() {
    if (this._remoddle) {
      this.unbind(this._remoddle.constructor.id)
      this._remoddle.disconnect()
      this._remoddle = undefined
    }
  }

  // functionality disabled due long delays between paddle hit and hearing tone 
  //
  // _tone(len) {
  //   if (this._bfoAmp) {
  //     this._bfoAmp.gain.setValueAtTime(_sidetoneLevel, 0); // TODO configurable
  //     setTimeout(() => {
  //       this._bfoAmp.gain.setValueAtTime(0, 0);
  //     }, len * (1200 / this._wpm + 5));
  //   }
  // }

  // _buildBFO() {
  //   let audioCtx = new AudioContext();
  //   this._bfo = audioCtx.createOscillator();
  //   this._bfoAmp = audioCtx.createGain();

  //   this._bfo.frequency.setValueAtTime(_sidetoneFreq, 0); // TODO configurable
  //   this._bfoAmp.gain.setValueAtTime(0, 0);

  //   this._bfo.connect(this._bfoAmp);
  //   this._bfoAmp.connect(audioCtx.destination);

  //   this._bfo.start();
  // }

  whenConnected(proceed) {
    if (this._port) {
      proceed()
    }
  }

  get modes() {
    return _modes
  }

  get vfos() {
    return _vfos
  }

  get bands() {
    return _bands
  }
  get band() {
    return this._band
  }
  set band(band) {
    this.whenConnected(() => {
      this._d("band", band)
      if (band in _bands) {
        this._band = band
        this.freq = this._freq[this._band][this._mode][this._rxVfo] // call setter  
      }
    })
  }

  get mode() {
    return this._mode
  }
  set mode(value) {
    this.whenConnected(() => {
      this._d("mode", value)
      if (value in _modes) {
        this._mode = value
        this.freq = this._freq[this._band][this._mode][this._rxVfo] // call setter
        // this._port.send("MD" + (this._mode + 1) + ";");
        this.fire(new TcvrEvent(EventType.mode, this._mode))
      }
    })
  }

  get freq() {
    return this._freq[this._band][this._mode][this._rxVfo]
  }
  set freq(freq) {
    this.whenConnected(() => {
      this._freq[this._band][this._mode][this._rxVfo] = freq
      this._d("freq", freq)
      this.fire(new TcvrEvent(EventType.freq, freq))
    })
  }

  get wpm() {
    return this._wpm
  }
  set wpm(wpm) {
    this.whenConnected(() => {
      this._wpm = wpm
      this._d("wpm", wpm)
      this.fire(new TcvrEvent(EventType.wpm, wpm))
    })
  }
  
  get filters() {
    return _filters
  }
  get filter() {
    return this._filter
  }
  set filter(index) {
    this.whenConnected(() => {
      if (index < 0 || index >= _filters.length || index == this._filter) {
        return
      }
      this._filter = index
      const bandwidth = this.bandwidth
      this.fire(new TcvrEvent(EventType.filter, {bandwidth: bandwidth, filter: index, narrow: this.narrow}))
    })
  }
  get bandwidth() {
    return _filters[this._filter]
  }

  // simplyfied filters management narrow/wide
  get narrow() {
    return this._filter <= _narrowFilter
  }
  set narrow(narrow) {
    this.filter = narrow ? _narrowFilter : _wideFilter
  }

  get preamp() {
    return this._preamp;
  }
  set preamp(state) {
    this.whenConnected(() => {
      this._preamp = state;
      this._d("preamp", this._preamp);
      this.fire(new TcvrEvent(EventType.preamp, this._preamp));
    });
  }

  get attn() {
    return this._attn;
  }
  set attn(state) {
    this.whenConnected(() => {
      this._attn = state;
      this._d("attn", this._attn);
      this.fire(new TcvrEvent(EventType.attn, this._attn));
    });
  }

  get txEnabled() {
    return this._txEnabled;
  }
  set txEnabled(txEnabled) {
    this.whenConnected(() => {
      this._txEnabled = txEnabled;
      this._d("txEnabled", txEnabled);
      // let data = "KE" + (txEnabled ? "1" : "0");
      // this._port.send(data + ";");
    });
  }

  get autoSpace() {
    return this._autoSpace;
  }
  set autoSpace(autoSpace) {
    this.whenConnected(() => {
      this._autoSpace = autoSpace;
      this._d("autoSpace", autoSpace);
      // let data = "KA" + (autoSpace ? "1" : "0");
      // this._port.send(data + ";");
    });
  }

  get txKeyed() {
    return this._txKeyed;
  }
  set txKeyed(txKeyed) {
    this.whenConnected(() => {
      this._txKeyed = txKeyed;
      this._d("txKeyed", txKeyed);
      // let data = "KT" + (txKeyed ? "1" : "0");
      // this._port.send(data + ";");
    });
  }

  // get sidetone() {
  //   return this._bfoAmp !== undefined;
  // }
  // set sidetone(state) {
  //   if (state) {
  //     if ( ! this.sidetone) {
  //       this._buildBFO();
  //     }
  //   } else {
  //     this._bfoAmp = undefined;
  //     this._bfo.stop();
  //   }
  // }

  get sidetoneFreq() {
    return _sidetoneFreq
  }

  bind(type, owner, callback) {
    if (!(type in this._listeners)) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(new EventListener(owner, callback));
    this._d("bind: " + type + ", for " + owner + ", callbacks:", this._listeners[type].length);
  }

  unbind(owner) {
    for (let type in this._listeners) {
      let stack = this._listeners[type];
      for (let i = 0, l = stack.length; i < l; i++) {
        if (stack[i].owner == owner) {
          this._d("removeEventListener for " + owner + " type", type);
          stack.splice(i, 1);
        }
      }
    }
  }

  fire(event) {
    let stack = this._listeners[event.type];
    stack && stack.forEach(listenner => listenner.callback.call(this, event));
    return true;//!event.defaultPrevented;
  }

  _d(what, value) {
    console.log(what + "=" + value);
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

const EventType = Object.freeze({
  freq: 1, wpm: 2, mode: 3, vfo: 4, filter: 5, preamp: 6, attn: 7, keyDit: 8, keyDah: 9, ptt: 10, tune: 11,
})

class ConnectorRegister {
  constructor() { this._reg = {} }

  register(connector) { this._reg[connector.constructor.id] = connector }
  get(id) { return this._reg[id] }

  get all() { return Object.values(this._reg) }
}

var tcvrConnectors = new ConnectorRegister();
