var Flume = require('flumedb')
var Log = require('flumelog-level')
var Index = require('../')

const dir = '/tmp/flumelog-level/test' + Math.random()

require('test-flumeview-index')(function (file, seed) {
  return Flume(Log(dir)())
    .use('index', Index(1, function (e) {
      console.log(e)
      return [e.key]
    }))
})


