const Flume = require('flumedb')
const Log = require('flumelog-offset')
const Index = require('../')

const codec = {
  encode: function (o) {
    const s = JSON.stringify(o)
    return s
  },
  decode: function (s) {
    //    var start = Date.now()
    const v = JSON.parse(s.toString())
    //  time += Date.now()-start
    return v
  },
  buffer: false
}

process.on('exit', function () {
  console.error('memory', process.memoryUsage())
})

require('test-flumeview-index/bench')(function (file) {
  return Flume(Log(file + 'log.offset', 1024, codec)).use(
    'index',
    Index(1, function (e) {
      return [e.key]
    })
  )
}, 5e4)
