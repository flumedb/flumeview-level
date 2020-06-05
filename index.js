'use strict'
var pull = require('pull-stream')
var Level = require('level')
var charwise = require('charwise')
var Write = require('pull-write')
var pl = require('pull-level')
var Obv = require('obv')
var path = require('path')
var Paramap = require('pull-paramap')
var ltgt = require('ltgt')
var explain = require('explain-error')

const noop = () => {};

module.exports = function (version, map) {
  return function (log, name) {
    var dir = path.dirname(log.filename)
    var db, writer

    var META = '\x00'
    var since = Obv()

    var closed, outdated

    function create () {
      closed = false
      if (!log.filename) {
        throw new Error(
          'flumeview-level can only be used with a log that provides a directory'
        )
      }
      return Level(path.join(dir, name), {
        keyEncoding: charwise,
        valueEncoding: 'json'
      })
    }

    function close (cb) {
      if (typeof cb !== 'function') {
        cb = noop
      }

      closed = true
      // todo: move this bit into pull-write
      if (outdated) {
        db.close(cb)
      } else if (writer) {
        writer.abort(function () {
          db.close((err) => {
            cb(err)
          })
        })
      } else if (!db) {
        cb()
      } else {
        since.once(function () {
          db.close(cb)
        })
      }
    }
    if (typeof process === 'object') {
      // Ensure that we always close the database before the process exists.
      process.on('beforeExit', close)
    }

    function destroy (cb) {
      // FlumeDB restarts the stream as soon as the stream is cancelled, so the
      // rebuild happens before `writer.abort()` calls back. This means that we
      // must run `since.set(-1)` before aborting the stream.
      since.set(-1)

      // The `writer` object is `undefined` on startup, so we need to ensure
      // that the writer actually exists before attempting to abort it.
      if (writer) {
        writer.abort(() => {
          db.clear(cb)
        })
      } else {
        db.clear(cb)
      }
    }

    if (closed) return

    db = create()

    db.get(META, { keyEncoding: 'utf8' }, function (err, value) {
      if (err) since.set(-1)
      else if (value.version === version) since.set(value.since)
      else {
        // version has changed, wipe db and start over.
        outdated = true
        destroy()
      }
    })

    return {
      since: since,
      methods: { get: 'async', read: 'source' },
      createSink: function (cb) {
        return (writer = Write(
          function (batch, cb) {
            if (closed) {
              return cb(new Error('database closed while index was building'))
            }
            db.batch(batch, function (err) {
              if (err) return cb(err)
              since.set(batch[0].value.since)
              // callback to anyone waiting for this point.
              cb()
            })
          },
          function reduce (batch, data) {
            if (data.sync) return batch
            var seq = data.seq

            if (!batch) {
              batch = [
                {
                  key: META,
                  value: { version: version, since: seq },
                  valueEncoding: 'json',
                  keyEncoding: 'utf8',
                  type: 'put'
                }
              ]
            }

            // map must return an array (like flatmap) with zero or more values
            var indexed = map(data.value, data.seq)
            batch = batch.concat(
              indexed.map(function (key) {
                return { key: key, value: seq, type: 'put' }
              })
            )
            batch[0].value.since = Math.max(batch[0].value.since, seq)
            return batch
          },
          512,
          cb
        ))
      },

      get: function (key, cb) {
        // wait until the log has been processed up to the current point.
        db.get(key, function (err, seq) {
          if (err && err.name === 'NotFoundError') return cb(err)
          if (err) {
            return cb(
              explain(err, 'flumeview-level.get: key not found:' + key)
            )
          }

          log.get(seq, function (err, value) {
            if (err) {
              if (err.code === 'flumelog:deleted') {
                return db.del(key, (delErr) => {
                  if (delErr) {
                    return cb(
                      explain(
                        delErr,
                        'when trying to delete:' +
                          key +
                          'at since:' +
                          log.since.value
                      )
                    )
                  }

                  cb(err, null, seq)
                })
              }

              return cb(
                explain(
                  err,
                  'flumeview-level.get: index for: ' +
                    key +
                    'pointed at:' +
                    seq +
                    'but log error'
                )
              )
            } else {
              cb(null, value, seq)
            }
          })
        })
      },
      read: function (opts) {
        var keys = opts.keys !== false
        var values = opts.values !== false
        var seqs = opts.seqs !== false
        opts.keys = true
        opts.values = true
        // TODO: preserve whatever the user passed in on opts...

        var lower = ltgt.lowerBound(opts)
        if (lower == null) opts.gt = null

        function format (key, seq, value) {
          return keys && values && seqs
            ? { key: key, seq: seq, value: value }
            : keys && values
              ? { key: key, value: value }
              : keys && seqs
                ? { key: key, seq: seq }
                : seqs && values
                  ? { seq: seq, value: value }
                  : keys
                    ? key
                    : seqs
                      ? seq
                      : value
        }

        return pull(
          pl.read(db, opts),
          pull.filter(function (op) {
            // this is an ugly hack! ); but it stops the index metadata appearing in the live stream
            return op.key !== META
          }),
          values
            ? pull(
              Paramap(function (data, cb) {
                if (data.sync) return cb(null, data)
                if (data.type === 'del') return cb(null, null)

                log.get(data.value, function (err, value) {
                  if (err) {
                    if (err.code === 'flumelog:deleted') {
                      return db.del(data.key, (delErr) => {
                        if (delErr) {
                          return cb(
                            explain(
                              err,
                              'when trying to delete:' +
                                  data.key +
                                  'at since:' +
                                  log.since.value
                            )
                          )
                        }

                        cb(null, null)
                      })
                    }

                    cb(
                      explain(
                        err,
                        'when trying to retrive:' +
                            data.key +
                            'at since:' +
                            log.since.value
                      )
                    )
                  } else cb(null, format(data.key, data.value, value))
                })
              }),
              pull.filter()
            )
            : pull.map(function (data) {
              return format(data.key, data.value, null)
            })
        )
      },
      close,
      destroy
      // put, del, batch - leave these out for now, since the indexes just map.
    }
  }
}
