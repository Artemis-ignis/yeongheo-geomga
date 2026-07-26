import { describe, it, expect } from 'vitest'
import { Input } from '../src/core/Input.js'

/** Minimal stand-in for `window` so Input can be tested without a DOM. */
function makeTarget() {
  const listeners = new Map()
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(fn)
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) ?? []
      const i = list.indexOf(fn)
      if (i !== -1) list.splice(i, 1)
    },
    fire(type, event = {}) {
      for (const fn of listeners.get(type) ?? []) fn({ preventDefault() {}, ...event })
    },
    get listenerCount() {
      let n = 0
      for (const list of listeners.values()) n += list.length
      return n
    },
  }
}

const keyDown = (t, code) => t.fire('keydown', { code })
const keyUp = (t, code) => t.fire('keyup', { code })

describe('Input movement', () => {
  it('is zero with nothing held', () => {
    const input = new Input(makeTarget())
    expect(input.moveX).toBe(0)
    expect(input.moveZ).toBe(0)
    expect(input.hasMove).toBe(false)
  })

  it('reads a single direction as a unit vector', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'KeyD')
    expect(input.moveX).toBe(1)
    expect(input.moveZ).toBe(0)
  })

  it('normalises diagonals so they are not faster', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'KeyW')
    keyDown(t, 'KeyD')
    expect(Math.hypot(input.moveX, input.moveZ)).toBeCloseTo(1, 10)
  })

  it('treats arrow keys the same as WASD', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'ArrowLeft')
    expect(input.moveX).toBe(-1)
  })

  it('cancels opposing keys', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'KeyA')
    keyDown(t, 'KeyD')
    expect(input.moveX).toBe(0)
    expect(input.hasMove).toBe(false)
  })

  it('stops on key up', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'KeyW')
    keyUp(t, 'KeyW')
    expect(input.hasMove).toBe(false)
  })

  it('clears held keys on blur so the player does not slide away', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'KeyW')
    t.fire('blur')
    expect(input.hasMove).toBe(false)
  })

  it('ignores auto-repeat', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'Space')
    t.fire('keydown', { code: 'KeyW', repeat: true })
    expect(input.hasMove).toBe(false)
  })
})

describe('Input edge-triggered actions', () => {
  it('latches dash and clears it on read', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'Space')
    expect(input.consumeDash()).toBe(true)
    expect(input.consumeDash()).toBe(false)
  })

  it('latches pause from both P and Escape', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'KeyP')
    expect(input.consumePause()).toBe(true)
    keyDown(t, 'Escape')
    expect(input.consumePause()).toBe(true)
  })

  it('reports the numbered slot once', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'Digit2')
    expect(input.consumeSlot()).toBe(2)
    expect(input.consumeSlot()).toBe(0)
  })

  it('latches confirm and debug', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'Enter')
    keyDown(t, 'F3')
    expect(input.consumeConfirm()).toBe(true)
    expect(input.consumeDebug()).toBe(true)
  })

  it('dispose removes every listener', () => {
    const t = makeTarget()
    const input = new Input(t)
    expect(t.listenerCount).toBe(3)
    input.dispose()
    expect(t.listenerCount).toBe(0)
  })
})
