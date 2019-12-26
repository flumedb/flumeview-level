const Flume = require('flumedb')
const Log = require('flumelog-offset')
const Index = require('../')
const codec = require('flumecodec')

require('test-flumeview-index/read')(function (file, seed) {
  return Flume(Log(file + '/log.offset', 1024, codec.json)).use(
    'index',
    Index(1, function (e) {
      console.log(e)
      return [e.key]
    })
  )
})
