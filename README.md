hypercore-multipart
===================

> Partition bytes into several Hypercore feeds

## Installation

```sh
$ npm install hypercore-multipart
```

## Example

```js
const multipart = require('hypercore-multipart')
const Corestore = require('corestore')
const fs = require('fs')

const corestore = new Corestore(ram)

fs.open('/path/to/file', (err, fd) => {
  multipart({ read, pageSize: 5 * 1024 * 1024, bufferSize: 4096 }, (err, parts) => {
    // `parts` is an array of hypercores with a byteLength at most `pageSize`
  })

  function read(offset, length, callback) {
    const buffer = Buffer.alloc(length)
    fs.read(fd, buffer, 0, length, offset, (err) => callback(err, buffer))
  }
})
```

## API

### `state = multipart(opts, callback)`

Reads bytes from a source partitioning chunks into Hypercore feeds where
calling `callback(err, parts)` with an error if one occurs or `parts`,
an array of hypercore feeds. `opts` can be:

```js
{
  bufferSize: 4096, // how big the read buffers should be
  pageSize: 10 * 1024 * 1024, // how big the hypercore feeds should be
  offset: 0, // the initial offset to start reading at

  corestore: null, // a corestore instance for hypercore creation
  masterKey: crypto.randomBytes(32), // the master key for key derivation
  namespace: 'multipart', // the namespace for key derivation

  read: null, // a function that accepts an offset, length, and callback to read bytes from a source
  stat: null, // a function that explicitly resolves the size of the
source
}
```

#### `state.bufferSize`

The read buffer size for the multipart state.

#### `state.pageSize`

The size for each page (hypercore feed) for the multipart state.

#### `state.offset`

The current read offset for the multipart state.

#### `state.blocks`

The number of blocks in the multipart state.

#### `state.page`

The current page of the multipart state.

#### `state.stats`

Stats (if available) for the multipart state.

#### `state.masterKey`

The master key for the multipart state.

## License

MIT
