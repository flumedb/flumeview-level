var pull = require('pull-stream')
var Level = require('level')
var bytewise = require('bytewise')
var Write = require('pull-write')
var pl = require('pull-level')
var Obv = require('obv')
var path = require('path')

function toIndex(key, seq) {
  return {key: key, value: seq, type: 'put'}
}

module.exports = function (version, map) {
  return function (log, name) {
    var db = create(path), writer

    var META = '\x00', since

    var written = 0, waiting = [], closed

    function create() {
      closed = false
      if(!log.dir)
        throw new Error('flumeview-level can only be used with a log that provides a directory')
      return Level(path.join(log.dir, name), {keyEncoding: bytewise, valueEncoding: 'json'})
    }

    function close (cb) {
      closed = true
      //todo: move this bit into pull-write
      if(writer) writer.abort(function () { db.close(cb) })
      else db.close(cb)
    }

    function destroy (cb) {
      close(function () {
        level.destroy(db, function () {
          db = create(); cb()
        })
      })
    }

    db.get(META, {keyEncoding: 'utf8'}, function (err, value) {
      since = value && value.since || 0
      if(err) since.set(-1)
      else if(value.version === version)
        since.set(value.since)
      else //version has changed, wipe db and start over.
        destroy(function () {
          db = create(path); since.set(-1)
        })
    })

    var since = Obv()

    return {
      createSink: function (cb) {
       return writer = Write(function (batch, cb) {
          if(closed) return cb(new Error('database closed while index was building'))
          db.batch(batch, function (err) {
            if(err) return cb(err)
            since = batch[0].value.since
            //callback to anyone waiting for this point.
            while(waiting.length && waiting[0].ts <= since) {
              waiting.shift().cb()
            }
            cb()
          })
        }, function reduce (batch, data) {
          if(data.sync) return batch
          var seq = data.seq

          if(!batch)
            batch = [{
              key: META,
              value: {version: version, since: seq},
              valueEncoding: 'json', keyEncoding:'utf8', type: 'put'
            }]

          //map must return an array (like flatmap) with zero or more values
          var indexed = map(data.value, data.seq)
          batch = batch.concat(indexed.map(toIndex))

          batch[0].value.since = Math.max(batch[0].value.since, ts)
          return batch
        }, 512, cb)
      },

      get: function (key, cb) {
        //wait until the log has been processed up to the current point.
        await(function () {
          db.get(key, cb)
        })
      },
      read: function (opts) {
        var keys = opts.keys
        var values = opts.values
        opts.keys = true; opts.values = true
        //TODO: preserve whatever the user passed in on opts...
        return pull(
          pl.read(db, opts),
          paramap(function (data, cb) {
            log.get(seq, function (err, value) {
              if(err) cb(err)
              else cb(null, {key: data.key, seq: data.value, value: value})
            })
          })
        )
      },
      close: close,
      destroy: destroy
      //put, del, batch - leave these out for now, since the indexes just map.
    }
  }
}

