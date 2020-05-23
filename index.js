const deriveKey = require('derive-key')
const crypto = require('hypercore-crypto')
const assert = require('nanoassert')

const DEFAULT_NAMESPACE = 'multipart'
const DEFAULT_BUFFER_SIZE = 4096
const DEFAULT_PAGE_SIZE = 10 * 1024 * 1024

const noop = () => void 0

/**
 * Reads bytes from a source partitioning chunks into Hypercore feeds.
 * @param {Object} opts
 * @param {?(Number)} opts.bufferSize How much to read at a time from the source
 * @param {?(Number)} opts.pageSize How big a partition (hypercore feed) should be
 * @param {?(Number)} opts.offset The offset to start reading from
 * @param {Corestore} opts.corestore The corestore used to create hypercore feeds
 * @param {?(Buffer)} opts.masterKey A master key used to derive keys from for each partition
 * @param {?(String)} opts.namespace The namespace used for key derivation. This is ignored if `opts.masterKey` is given
 * @param {?(Function)} opts.stat A function that should callback with the size of the source.
 * @param {Function} opts.read A function that accepts an offset and length and should callback with a buffer.
 * @param {Function} callback
 */
function multipart(opts, callback) {
  assert(opts && 'object' === typeof opts, 'Expecting `opts` is an object')
  assert('function' === typeof callback, 'Expecting `callback` to be a function')

  const { bufferSize = DEFAULT_BUFFER_SIZE } = opts
  const { pageSize = DEFAULT_PAGE_SIZE } = opts
  const { stat = defaultStat } = opts
  const { read = noop } = opts
  const { corestore } = opts
  const { masterKey = crypto.randomBytes(32) } = opts
  const { namespace = DEFAULT_NAMESPACE } = opts
  let { stats = null } = opts
  let { offset = 0 } = opts

  assert(bufferSize > 0, 'Invalid `bufferSize` value. Expecting > 0')
  assert(pageSize > 0, 'Invalid `pageSize` value. Expecting > 0')
  assert(offset >= 0, 'Invalid `offset` value. Expecting >= 0')
  assert('function' === typeof stat, 'Invalid `stat` value. Expecting function')
  assert('function' === typeof read, 'Invalid `read` value. Expecting function')
  assert(corestore, 'Invalid `corestore` value. Expecting object')

  assert(namespace && 'string' === typeof namespace,
    'Invalid `namespace` value. Expecting string with length')

  assert(Buffer.isBuffer(masterKey) && 32 === masterKey.length,
    'Invalid `masterKey`. Expecting a 32 byte buffer')

  const hypercores = []

  let blocks = 0
  let page = Math.floor(offset / pageSize) + 1

  corestore.ready(onready)

  return {
    get bufferSize() {
      return bufferSize
    },

    get pageSize() {
      return pageSize
    },

    get corestore() {
      return corestore
    },

    get masterKey() {
      return masterKey
    },

    get offset() {
      return offset
    },

    get blocks() {
      return blocks
    },

    get page() {
      return page
    },

    get stats() {
      return stats
    },
  }

  function onready(err) {
    if (err) { return callback(err) }
    stat(onstats)
  }

  function onstats(err, res) {
    if (err) { return callback(err) }
    stats = res
    read(offset, Math.min(pageSize, bufferSize), onread)
  }

  function onread(err, buffer) {
    if (err) { return callback(err) }
    if (!buffer || 0 === buffer.length) {
      return callback(null, hypercores)
    }

    offset = offset + buffer.length

    getHypercore(page, (err, hypercore) => {
      if (err) { return callback(err) }
      page = Math.floor(offset / pageSize) + 1
      hypercore.append(buffer, onappend)
    })
  }

  function onappend(err) {
    if (err) { return callback(err) }
    blocks++;
    if (null === stats || offset < stats.size) {
      read(offset, Math.min(pageSize, bufferSize), onread)
    } else {
      // istanbul ignore next
      callback(null, hypercores)
    }
  }

  function getHypercore(page, onhypercore) {
    const index = page - 1
    if (!hypercores[index]) {
      const hypercore = createtHypercore(corestore, { namespace, masterKey, page })
      hypercore.page = page
      hypercores[index] = hypercore
    }

    hypercores[index].ready((err) => onhypercore(err, hypercores[index]))
  }
}

function defaultStat(callback) {
  callback(null, null)
}

function createtHypercore(corestore, opts) {
  const { publicKey, secretKey } = keyPair(opts)
  return corestore.get({ keyPair: { publicKey, secretKey } })
}

function keyPair(opts) {
  const { namespace = DEFAULT_NAMESPACE, masterKey, page } = opts
  const seed = deriveKey(namespace, masterKey, String(page))
  return crypto.keyPair(seed)
}

module.exports = Object.assign(multipart, {
  keyPair
})
