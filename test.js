
var Flume = require('flumedb')
var Log = require('flumelog-offset')
var Index = require('./')
var codec = require('flumecodec')

var db = Flume(Log('/tmp/test-flumeview-index'+Date.now()+'/log.offset', 1024, codec.json))
  .use('index', Index(1, function (e) { return [e.key] }))

require('test-flumeview-index')(db)

