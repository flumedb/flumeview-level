# flumeview-level

A flumeview implemented on top of level.

Provides indexes which are persistent and can be streamed in order.

Work In Progress.

## example

``` js
flumedb.use(name, function (value) {
  return data.foo
})

flumedb.append({foo: 'bar'}, function (err) {
  if(err) throw err
  flumedb.get('bar', function (err, value) {
    if(err) throw err
    console.log(value) // => {foo: 'bar'})
  })
})
```

## License

MIT

