const Networking = require('corestore-swarm-networking')
const Corestore = require('corestore')
const multipart = require('./')
const crypto = require('hypercore-crypto')
const ram = require('random-access-memory')

const blob = crypto.randomBytes(1024)
const masterKey = crypto.randomBytes(32)
const discoveryKey = crypto.randomBytes(32)

const alice = Node(discoveryKey)

const opts = {
  masterKey, read,

  bufferSize: 32,
  corestore: alice.corestore,
  pageSize: 256,
  onpage(page, hypercore) {
    console.log(page, hypercore);
  }
}

multipart(opts, onmultipart)

function Node(discoveryKey) {
  const corestore = new Corestore(ram)
  const networking = new Networking(corestore)
  networking.join(discoveryKey)
  return { corestore, networking, discoveryKey }
}

function read(offset, length, callback) {
  callback(null, blob.slice(offset, offset + length))
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

function onmultipart(err, parts) {
  if (err) { throw err }
  const bob = Node(discoveryKey)
  bob.corestore.ready(() => {
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
        console.log(Buffer.compare(blob, Buffer.concat(buffers))) // 0
      })
    })
  })
}
