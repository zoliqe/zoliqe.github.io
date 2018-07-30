//import Chart from 'chart.bundle.min.js'

const connectButton = document.querySelector('#connectButton')
const logEl = document.querySelector('#log')
// const canvas = document.querySelector('#graph')
// const ctx = canvas.getContext('2d')

// canvas.height = 500
// canvas.width = count
const freqs = [3400, 3500, 3600, 3700, 3800, 3900, 4000, 4500, 5000, 5100, 5200, 5500, 6000, 6500, 6900, 7000, 7100, 7200, 7300, 7400, 7500,
  8000, 8500, 9000, 9500, 10000, 10100, 10200, 10300, 10500, 11000, 11500, 12000, 12500, 13000, 13500, 13900, 14000, 14100, 14200, 14300, 14400, 14500,
  15000, 15500, 16000, 16500, 17000, 17500, 18000, 18100, 18500, 19000, 19500, 20000, 20500, 20900, 21000, 21100, 21200, 21300, 21400, 21500, 22000,
  22500, 23000, 23500, 24000, 24500, 24800, 24900, 25000, 25500, 26000, 26500, 27000, 27500, 27900, 28000, 28100, 28200, 28300, 28400, 28500, 29000]
const count = freqs.length
const values = new Array(count)
values.fill(1)
let index = 0

const chart = new Chart('graph', {
  type: 'line',
  data: {
    datasets: [{
      label: 'SWR',
      data: values
    }],
    labels: freqs
  },
  options: {
    scales: {
      yAxes: [{
        ticks: {
          min: 1,
          max: 10,
          stepSize: 1
        }
      }],
    }
  }
})

// chart.canvas.parentNode.style.height = '300px'

function log(text) {
  logEl.innerHTML = text
}

function value(val) {
//  let values = chart.data.datasets[0].data
  const swr = getBaseLog(1.5, parseInt(val) + 1) + 1
  values[index] = swr > 10 ? 10 : swr
  if (index < count - 1) {
    values[index + 1] = 1
  }
  chart.data.datasets.forEach((dataset) => {
      dataset.data = values
  })
  chart.update()
    
  index++
  if (index >= count) {
    index = 0
  }
  mbit.send(freqs[index])
}

function getBaseLog(x, y) {
  return Math.log(y) / Math.log(x);
}

connectButton.onclick = e => connectMicrobit(log, (mbit) => {
  mbit.valueChanged = val => value(val)
  connectButton.disabled = true
  mbit.send(freqs[index])
})

log('Ready')
