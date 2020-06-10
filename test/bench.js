
var Flume = require('flumedb')
var Log = require('flumelog-offset')
var Index = require('../')
var codec = require('flumecodec')

require('test-flumeview-index/bench')(function (file, seed) {
  return Flume(Log(file+'/log.offset', 1024, codec.json))
    .use('index', Index(1, function (e) { return [e.key] }))
})



