
var Flume = require('flumedb')
var Log = require('flumelog-offset')
var Index = require('../')
var codec = require('flumecodec')

var decodes = 0, time = 0, start = Date.now()
var codec = {
  encode: function (o) {
    var s = JSON.stringify(o)
    return s
  },
  decode: function (s) {
    decodes ++
//    var start = Date.now()
    var start = process.hrtime()
    var v = JSON.parse(s.toString())
    time += process.hrtime(start)[1]
  //  time += Date.now()-start
    return v
  },
  buffer: false,
}

process.on('exit', function () {
  console.error('memory', process.memoryUsage())
})


require('test-flumeview-index/bench')(function (file, seed) {
  return Flume(Log(file+'log.offset', 1024, codec))
    .use('index', Index(1, function (e) { return [e.key] }))
}, 5e4)


