# flumeview-level

A flumeview implemented on top of level.

Provides indexes which are persistent and can be streamed in order.


## example

``` js
flumedb.use(name, function (value) {
  return [data.foo] // must return an array
})

flumedb.append({foo: 'bar'}, function (err) {
  if(err) throw err

  //query items from the index directly
  flumedb[name].get('bar', function (err, value) {
    if(err) throw err
    console.log(value) // => {foo: 'bar'})
  })

  //or query ranges via pull-streams
  pull(
    flumedb[name].read({gte: 'bar', live: true}),
    ...
  )

})
```

## License

MIT


