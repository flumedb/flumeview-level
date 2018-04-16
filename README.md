# flumeview-level

A flumeview implemented on top of level.

Provides indexes which are persistent and can be streamed in order.


## example

``` js
var FlumeviewLevel = require('flumeview-level')

flumedb.use(name, FlumeviewLevel(1, function map (value) {
  return [data.foo] // must return an array
}))

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

## API

### `FlumeviewLevel(version, map) => function`

`version` - the version of the view. Incrementing this number will cause the view to be re-built

`map` - a function with signature `(value, seq)`, where `value` is the item from the log coming past, and `seq` is the location of that value in the flume log. This function must return either: 
  - an array of items, where each item is going to become the lookup key in the leveldb 
    - the lookup key can be a string e.g. `address-mix` or e.g. and array `['name', '%feqasd23asd']` 
  - empty `[]`, which signals this value will be excluded from the index 


`function` - flumeview-level returns a function which follows the flumeview pattern, enabling it to be installed into a flumedb.


### `get(key, cb)`

This is a method that gets attached to the flumedb after you install your flumeview (see example above).


### `read(opts) => pull-stream`

`opts` is a level db query. Some example options you can include: 

```js
{
  live: true,
  reverse: true,
  keys: true,
  values: true,
  seqs: false,
  gte: 'name' // gte: greater than or equal to
}
```

NOTE - if your keys are Arrays, your comparators should follow the same pattern e.g. `['name', null]` will get all keys where the first entry in the array is compared to 'name'

Here are some other options you can pass which get passed to the underlying leveldb:
https://github.com/Level/levelup#dbcreatereadstreamoptions


## License

MIT


