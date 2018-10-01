
var Flume = require('flumedb')
var Log = require('flumelog-offset')
var Index = require('../')
var codec = require('flumecodec')

require('test-flumeview-index/live')(function (file, seed) {
  return Flume(Log(file+'/log.offset', 1024, codec.json))
    .use('index', Index(1, function (e) {
      console.log(e)
      return [e.key]
    }))
})



