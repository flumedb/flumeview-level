var Flume = require('flumedb')
var log = require('flumelog-level')('/tmp/flumelog-level-read-' + Math.random())()
var Index = require('../')

require('test-flumeview-index/read')(function (file, seed) {
  return Flume(log)
    .use('index', Index(1, function (e) {
      console.log(e)
      return [e.key]
    }))
})


