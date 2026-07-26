import { describe, it, expect, vi } from 'vitest'
import { Emitter } from '../src/core/Events.js'

describe('Emitter', () => {
  it('calls listeners with the payload', () => {
    const e = new Emitter()
    const fn = vi.fn()
    e.on('levelUp', fn)
    e.emit('levelUp', { level: 3 })
    expect(fn).toHaveBeenCalledWith({ level: 3 })
  })

  it('supports multiple listeners in registration order', () => {
    const e = new Emitter()
    const calls = []
    e.on('x', () => calls.push('a'))
    e.on('x', () => calls.push('b'))
    e.emit('x')
    expect(calls).toEqual(['a', 'b'])
  })

  it('returns an unsubscribe function', () => {
    const e = new Emitter()
    const fn = vi.fn()
    e.on('x', fn)()
    e.emit('x')
    expect(fn).not.toHaveBeenCalled()
  })

  it('off() removes a specific listener', () => {
    const e = new Emitter()
    const a = vi.fn()
    const b = vi.fn()
    e.on('x', a)
    e.on('x', b)
    e.off('x', a)
    e.emit('x')
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalled()
  })

  it('emitting an unknown event is a no-op', () => {
    expect(() => new Emitter().emit('nothing')).not.toThrow()
  })

  it('a listener unsubscribing during emit does not skip its neighbour', () => {
    const e = new Emitter()
    const seen = []
    const off = e.on('x', () => { seen.push('a'); off() })
    e.on('x', () => seen.push('b'))
    e.emit('x')
    expect(seen).toEqual(['a', 'b'])
  })

  it('clear() removes everything', () => {
    const e = new Emitter()
    const fn = vi.fn()
    e.on('x', fn)
    e.clear()
    e.emit('x')
    expect(fn).not.toHaveBeenCalled()
  })
})
