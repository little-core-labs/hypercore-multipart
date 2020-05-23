const Networking = require('corestore-swarm-networking')
const Corestore = require('corestore')
const multipart = require('./')
const crypto = require('hypercore-crypto')
const test = require('tape')
const ram = require('random-access-memory')

function Node(discoveryKey) {
  const corestore = new Corestore(ram)
  const networking = new Networking(corestore)
  networking.join(discoveryKey)
  return { corestore, networking, discoveryKey, close }
  function close() {
    batch([
      (done) => corestore.close(done),
      (done) => networking.close(done),
    ], (err) => {
      err && console.warn(err)
    })
  }
}

function batch(array, callback, results) {
  if (!results) {
    results = []
  }

  if (!array.length) {
    callback(null, results)
  } else {
    array.shift()((err, result) => {
      if (err) { callback(err) }
      else { batch(array, callback, results.concat(result)) }
    })
  }
}

test('multipart(opts, callback)', (t) => {
  const blob = crypto.randomBytes(1024)
  const masterKey = crypto.randomBytes(32)
  const discoveryKey = crypto.randomBytes(32)

  const alice = Node(discoveryKey)

  let pages = 0
  const opts = {
    masterKey, read,

    bufferSize: 32,
    corestore: alice.corestore,
    pageSize: 256,
    onpage(page, hypercore) {
      t.equal(++pages, page)
      t.ok(hypercore)
    }
  }

  const state = multipart(opts, onmultipart)
  t.equal(state.bufferSize, opts.bufferSize)
  t.equal(state.pageSize, opts.pageSize)
  t.equal(state.corestore, alice.corestore)
  t.equal(state.masterKey, opts.masterKey)
  t.equal(state.offset, 0)
  t.equal(state.blocks, 0)
  t.equal(state.page, 1)
  t.equal(state.stats, null)

  function read(offset, length, callback) {
    callback(null, blob.slice(offset, offset + length))
  }

  function onmultipart(err, parts) {
    t.error(err)
    const bob = Node(discoveryKey)
    bob.corestore.ready((err) => {
      t.error(err)
      const keys = Array.from(Array(parts.length), (_, i) => multipart.keyPair({
        masterKey, page: i + 1
      }))

      const feeds = keys.map((kp) => bob.corestore.get({ key: kp.publicKey }))
      const ready = feeds.map((feed) => (done) => feed.ready(done))
      batch(ready, (err) => {
        const reads = feeds.map((feed) => (done) => feed[feed.length ? 'ready' : 'update'](() => {
          feed.getBatch(0, feed.length, done)
        }))

        batch(reads, (err, buffers) => {
          t.error(err)
          t.ok(0 === Buffer.compare(blob, Buffer.concat(buffers)))
          t.equal(pages, parts.length)
          alice.close()
          bob.close()
          t.end()
        })
      })
    })
  }
})
