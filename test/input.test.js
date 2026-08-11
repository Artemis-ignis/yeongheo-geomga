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

/** A standard-mapping pad whose axes and buttons the test drives directly. */
function makePad() {
  const pad = {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    press(i) { pad.buttons[i] = { pressed: true, value: 1 } },
    release(i) { pad.buttons[i] = { pressed: false, value: 0 } },
    stick(x, z) { pad.axes[0] = x; pad.axes[1] = z },
  }
  return pad
}

/**
 * A controller is table stakes for this genre — every game this one is measured
 * against ships one — and `Input` was keyboard-only. The whole pad path takes
 * its device list through an injected function so it can be driven here without
 * a browser or hardware, the same way `Save` takes its storage.
 */
describe('gamepad', () => {
  const rig = () => { const t = makeTarget(); const pad = makePad(); return { t, pad, input: new Input(t, () => [pad]) } }

  it('does nothing at all when no pad is connected', () => {
    const t = makeTarget()
    const input = new Input(t, () => [])
    input.poll()
    expect(input.moveX).toBe(0)
    expect(input.usingGamepad).toBe(false)
    expect(input.consumeDash()).toBe(false)
  })

  it('ignores a resting stick', () => {
    const { input, pad } = rig()
    pad.stick(0.1, -0.08)
    input.poll()
    expect(input.moveX).toBe(0)
    expect(input.moveZ).toBe(0)
  })

  it('starts from a standstill at the edge of the deadzone rather than lurching', () => {
    const { input, pad } = rig()
    pad.stick(0.19, 0)
    input.poll()
    expect(input.moveX).toBeGreaterThan(0)
    expect(input.moveX, 'the deadzone edge jumps straight to a walk').toBeLessThan(0.1)
  })

  it('keeps the stick\'s magnitude, so a pad can walk', () => {
    const { input, pad } = rig()
    pad.stick(0, -0.6)
    input.poll()
    const half = Math.abs(input.moveZ)
    pad.stick(0, -1)
    input.poll()
    expect(Math.abs(input.moveZ)).toBeGreaterThan(half)
    expect(Math.abs(input.moveZ)).toBeCloseTo(1, 2)
  })

  it('never lets a diagonal outrun a straight line', () => {
    const { input, pad } = rig()
    pad.stick(1, 1)
    input.poll()
    expect(Math.hypot(input.moveX, input.moveZ)).toBeLessThanOrEqual(1.0001)
  })

  it('latches a button press once, not once per frame it is held', () => {
    const { input, pad } = rig()
    pad.press(0)
    input.poll()
    expect(input.consumeDash()).toBe(true)
    input.poll()
    expect(input.consumeDash(), 'a held button re-fired').toBe(false)
    pad.release(0)
    input.poll()
    pad.press(0)
    input.poll()
    expect(input.consumeDash(), 'a fresh press did not register').toBe(true)
  })

  it('pauses on start and confirms on the south face', () => {
    const { input, pad } = rig()
    pad.press(9)
    input.poll()
    expect(input.consumePause()).toBe(true)
    pad.release(9)
    pad.press(0)
    input.poll()
    expect(input.consumeConfirm()).toBe(true)
  })

  it('steers menus with the d-pad', () => {
    const { input, pad } = rig()
    pad.press(14)
    input.poll()
    expect(input.moveX).toBeLessThan(-0.5)
    pad.release(14)
    input.poll()
    pad.press(15)
    input.poll()
    expect(input.moveX).toBeGreaterThan(0.5)
  })

  it('hands control back to whichever device was used last', () => {
    const { input, pad, t } = rig()
    pad.stick(1, 0)
    input.poll()
    expect(input.usingGamepad).toBe(true)
    expect(input.moveX).toBeCloseTo(1, 2)

    // A key press takes over even while the stick is still held over.
    keyDown(t, 'KeyA')
    expect(input.usingGamepad).toBe(false)
    expect(input.moveX).toBe(-1)

    // And the stick takes it back on the next poll that sees movement.
    input.poll()
    expect(input.usingGamepad).toBe(true)
    expect(input.moveX).toBeCloseTo(1, 2)
    keyUp(t, 'KeyA')
  })

  it('does not steal control from the keyboard while resting', () => {
    const { input, pad, t } = rig()
    keyDown(t, 'KeyD')
    pad.stick(0.05, 0.05)
    input.poll()
    expect(input.usingGamepad, 'a resting stick grabbed control').toBe(false)
    expect(input.moveX).toBe(1)
    keyUp(t, 'KeyD')
  })

  it('hands control back to a held keyboard direction when the stick returns to neutral', () => {
    const { input, pad, t } = rig()
    keyDown(t, 'KeyD')
    pad.stick(1, 0)
    input.poll()
    expect(input.usingGamepad).toBe(true)

    pad.stick(0, 0)
    input.poll()
    expect(input.usingGamepad).toBe(false)
    expect(input.moveX).toBe(1)

    pad.connected = false
    input.poll()
    expect(input.usingGamepad).toBe(false)
    expect(input.moveX).toBe(1)
    keyUp(t, 'KeyD')
    input.poll()
    expect(input.usingGamepad).toBe(false)
    expect(input.moveX).toBe(0)
  })

  it('survives a pad that reports nothing useful', () => {
    const t = makeTarget()
    const input = new Input(t, () => [null, { connected: false }, {}])
    expect(() => input.poll()).not.toThrow()
    expect(input.moveX).toBe(0)
  })
})

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

  it('lets a focused DOM button own Enter and Space activation', () => {
    const t = makeTarget()
    const input = new Input(t)
    const button = { tagName: 'BUTTON' }
    t.fire('keydown', { code: 'Enter', target: button })
    t.fire('keydown', { code: 'Space', target: button })
    expect(input.consumeConfirm(), 'a native click was duplicated by global confirm').toBe(false)
    expect(input.consumeDash(), 'a focused button fired the gameplay dash latch').toBe(false)
  })

  it('treats Space as a menu confirm while retaining its combat dash edge', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'Space')
    expect(input.consumeConfirm()).toBe(true)
    expect(input.consumeDash()).toBe(true)
  })

  it('discards the paired dash edge when Space or the gamepad confirms a modal', () => {
    const t = makeTarget()
    const keyboard = new Input(t)
    keyDown(t, 'Space')
    expect(keyboard.consumeConfirm()).toBe(true)
    keyboard.discardDash()
    expect(keyboard.consumeDash()).toBe(false)

    const { input: gamepad, pad } = (() => {
      const target = makeTarget()
      const controller = makePad()
      return { input: new Input(target, () => [controller]), pad: controller }
    })()
    pad.press(0)
    gamepad.poll()
    expect(gamepad.consumeConfirm()).toBe(true)
    gamepad.discardDash()
    expect(gamepad.consumeDash()).toBe(false)
  })

  it('latches world interaction on E and clears it on read', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'KeyE')
    expect(input.consumeInteract()).toBe(true)
    expect(input.consumeInteract()).toBe(false)
  })

  it('dispose removes every listener', () => {
    const t = makeTarget()
    const input = new Input(t)
    expect(t.listenerCount).toBe(4)
    input.dispose()
    expect(t.listenerCount).toBe(0)
  })

  it('sums wheel deltas and drains them once', () => {
    const t = makeTarget()
    const input = new Input(t)
    t.fire('wheel', { deltaY: 100 })
    t.fire('wheel', { deltaY: 100 })
    expect(input.consumeZoom()).toBeCloseTo(2)
    expect(input.consumeZoom()).toBe(0)
  })

  it('clamps a single huge wheel delta so a trackpad flick cannot slam the rig', () => {
    const t = makeTarget()
    const input = new Input(t)
    t.fire('wheel', { deltaY: 4000 })
    expect(input.consumeZoom()).toBe(1)
  })

  it('keeps zooming while a zoom key is held', () => {
    const t = makeTarget()
    const input = new Input(t)
    keyDown(t, 'Minus')
    expect(input.consumeZoom()).toBeGreaterThan(0)
    // Still held, so it must still report — unlike the latched actions.
    expect(input.consumeZoom()).toBeGreaterThan(0)
    keyUp(t, 'Minus')
    expect(input.consumeZoom()).toBe(0)
  })
})
