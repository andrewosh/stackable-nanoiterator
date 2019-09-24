module.exports = class StackIterator {
  constructor (opts = {}) {
    this.maxDepth = opts.maxDepth || -1

    this.open = opts.open
    this.map = opts.map
    this.onpush = opts.onpush
    this.onpop = opts.onpop

    this._stack = []
    this._opened = false
    this._destroyed = false
    this._depth = 0
  }

  push (iterator, state) {
    if ((this._depth >= this.maxDepth) && this.maxDepth !== -1) return
    this._depth++
    const entry = { iterator, state }
    this._stack.unshift(entry)
    if (this.onpush) this.onpush(entry.iterator, entry.state)
  }

  next (cb) {
    if (this._destroyed) return cb(new Error('Iterator was destroyed.'))
    if (!this._opened) {
      if (this.open) {
        return this.open(err => {
          if (err) return cb(err)
          this._opened = true
          return this.next(cb)
        })
      } else {
        this._opened = true
      }
    }
    if (!this._stack.length) return cb(null, null)
    const { iterator } = this._stack[0]
    return iterator.next((err, val) => {
      if (err) return cb(err)
      if (val === null) {
        const popped = this._stack.shift()
        this._depth--
        if (this.onpop) this.onpop(popped.iterator, popped.state)
        return this.next(cb)
      }
      if (this.map) val = this.map(val, this._stack.map(s => s.state))
      return cb(null, val)
    })
  }

  destroy (cb) {
    this._destroyed = true
    var pending = this._stack.length
    if (!pending) return process.nextTick(cb, null)
    var error = null
    for (const { iterator } of this._stack) {
      iterator.destroy(err => {
        if (err) {
          error = err
          pending--
          return
        }
        if (!--pending) return cb(error)
      })
    }
  }
}
