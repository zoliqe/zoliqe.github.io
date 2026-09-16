const freqs = [3550, 7050, 10120, 14050, 18080, 21050, 24950, 28050]
const connectButton = document.querySelector('#connectButton')
const bandDn = document.querySelector('#bandDn')
const bandUp = document.querySelector('#bandUp')
const mhzDn = document.querySelector('#mhzDn')
const mhzUp = document.querySelector('#mhzUp')
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

let band = 1

function log(text) {
  logEl.innerHTML = text
}

function value(val) {
  values.shift()
  values.push((getBaseLog(1.5, parseInt(val) + 1)) + 1)

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

connectButton.onclick = e => connectMicrobit(log, (mbit) => {
    mbit.valueChanged = val => value(val)
    connectButton.disabled = true
    knob.tune(knob.freq)
    knob.locked = false
    setInterval(() => mbit.send('?'), 200)
})
bandDn.onclick = e => {
  band = band > 0 ? --band : freqs.length - 1
  const f = freqs[band]
  knob.freq = f
  knob.tune(f)
}
bandUp.onclick = e => {
  band = band < (freqs.length - 1) ? ++band : 0
  const f = freqs[band]
  knob.freq = f
  knob.tune(f)
}
mhzDn.onclick = e => {
  if (knob.freq < 4500) return
  knob.freq -= 1000
  knob.tune(knob.freq)
}
mhzUp.onclick = e => {
  if (knob.freq > 29000) return
  knob.freq += 1000
  knob.tune(knob.freq)
}

let knob = new TuningKnob(document.querySelector('#knob'), freqs[band], 10)
knob.locked = true
knob.tune = (value) => {
  if (value < 3500) {
    return 3500
  }
  if (value > 30000) {
    return 30000
  }

  freq.innerHTML = value + ' kHz'
  mbit.send(value)
  return value
}

log('Ready')
