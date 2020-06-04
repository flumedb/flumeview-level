var Flume = require('flumedb')
var Log = require('flumelog-offset')
var Index = require('../')

var codec = {
  encode: function (o) {
    return JSON.stringify(o)
  },
  decode: function (s) {
    return JSON.parse(s.toString())
  },
  buffer: false
}

process.on('exit', function () {
  console.error('memory', process.memoryUsage())
})

require('test-flumeview-index/bench')(function (file, seed) {
  return Flume(Log(file + 'log.offset', 1024, codec)).use(
    'index',
    Index(1, function (e) {
      return [e.key]
    })
  )
}, 5e4)
