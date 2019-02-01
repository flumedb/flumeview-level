var Flume = require('flumedb')
var log = require('flumelog-level')('/tmp/flumelog-level-bench-' + Math.random())()
var Index = require('../')

require('test-flumeview-index/bench')(function (file, seed) {
  return Flume(log)
    .use('index', Index(1, function (e) { return [e.key] }))
})



