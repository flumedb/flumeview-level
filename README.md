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

#### `version`
The version of the view. Incrementing this number will cause the view to be re-built

#### `map`
A function with signature `(value, seq)`, where `value` is the item from the log coming past, and `seq` is the location of that value in the flume log.

This function **must return an Array** that's either empty or contains unique index key(s).
These index keys can then be queired to retrieve the stored value (see `get` and `read` below).

Examples of index key(s) you might return:
- `[]` - i.e. don't add any indexes for this `value`
- `['@mix']` - make an index entry for this value under string `@mix`
- `['@mix', '@mixmix']` - make an index entries for this value under both `@mix` AND `@mixmix`
- `[['@mix', 1524805117433]]` - make an index entry for this value under the key `['@mix', 1524805117433]` (anything can be a key in leveldb)

This last case is useful when you might want multiple entries under a particular key like `@mix` - if just use `@mix` then the index will get overwritten by future values coming in with the same key.
Extending the key to include some unique aspect (like a timestamp or the `seq` of the value) means you can have multiple indexes in your view which have a _similar_ key.

e.g. [flumeview-search](https://github.com/flumedb/flumeview-search) is a flumeview which takes the text from incoming values and builds an index which can be searched.
It takes a sentence like "Learn about leveldb" and maps that into 3 index keys like `['learn', 'about', 'leveldb']`, each of which will point back to the sentence "Learn about leveldb".
In practice the 3 indexes need to be more unique if we don't want there to be only one index for `learn` - e.g. `[['learn', 145], ['about', 145], ['leveldb', 145]]` will mean we can later add an index `['learn', 2034]` and it will be distinct from `['learn', 145]`.
Here 145, 2034 are just unique numbers which keep in index unique - using seq or timestamp is common for this.


#### `function`
flumeview-level returns a function which follows the flumeview pattern, enabling it to be installed into a flumedb.


### `get(key, cb)`

This is a method that gets attached to the flumedb after you install your flumeview (see example above).

The keys for the values in `map` above would be `'@mix'`, `'@mixmix'`, or `['@mix', 1524805117433]`


### `read(opts) => pull-stream`

`opts` is similar to a level db query ([see level docs](https://github.com/Level/levelup#dbcreatereadstreamoptions)).

e.g.

```js
{
  live: true,     // this is an addition to the classic query options of level
  gte: '@mi',     // gte = greater than or equal to
  lt: undefined,       // lt = less than
  reverse: true,
  keys: true,
  values: true,
  seqs: false,
}
```

If you've created indexes that are Arrays (quite likely), you need to understand how Arrays and other value are ordered by leveldb.
This is because using leveldb is all about ordering keys so that you can do queries efficiently.
Because of the way a log-structured-merge-tree works (what level is) it can read adjacent records quickly (with a single seek) but jumping around is not as fast.
Read about the pattern of ordering of keys/ indexes flumeview-level uses [here](https://github.com/deanlandolt/bytewise) (actually uses [charwise](https://github.com/dominictarr/charwise) under the hood, but follows the bytewise spec).

Example of more advanced query:

```js
{
  gte: ['@mix', 1524720269458],
  lte: ['@mix', undefined],
}
```

Assume this is an index where the keys are of the form `[@mentions, timestamp], then this query will get all mentions which are _exactly_ '@mix', and happened more recently than 2018-04-27 5pm NZT (note `undefined` is the highest value in [bytewise](https://github.com/deanlandolt/bytewise#order-of-supported-structures) comparator)

If you wanted to get all mentions which _started with_ `@m` you could use:

```js
{
  gte: ['@m', null],
  lt: ['@m~', undefined],
}
```

Here `null` is the lowest value in the comparator, and the `~` is just a slightly unreliable hack to catch values below `@m~` as `~` is quite a high character (e.g. above Z) for lexicographic ordering (there are higher characters but english people are less likely to type them, check [ltgt](https://github.com/dominictarr/ltgt) to generate reliable limiting values).

Here's some lexographically ordered strings to help you catch the vibe:
'@nevernever', '@m', '@manowar', '@ma~', '@mo', '@m~'


## License

MIT


