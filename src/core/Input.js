const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
}

/**
 * Standard-gamepad button indices, per the W3C mapping every controller worth
 * supporting reports. Named rather than inlined because `buttons[9]` in a
 * condition is unreadable and wrong silently.
 */
const PAD = {
  south: 0, east: 1, west: 2, north: 3,
  l1: 4, r1: 5,
  select: 8, start: 9,
  up: 12, down: 13, left: 14, right: 15,
}

/**
 * Stick deadzone. Cheap analogue sticks rest anywhere inside about 0.12; going
 * much above that eats the slow walk that makes threading a crowd possible.
 */
const DEADZONE = 0.18
/** How far a stick or trigger must travel before it counts as a press. */
const AXIS_PRESS = 0.55

/**
 * Walks up from a wheel event's target looking for an element that can actually
 * scroll — overflowing content *and* a style that permits it. Returns false in
 * the test environment, where there is no real DOM and nothing to protect.
 */
function scrollableUnder(node) {
  if (typeof getComputedStyle !== 'function') return false
  for (let el = node; el && el.nodeType === 1; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight) continue
    const oy = getComputedStyle(el).overflowY
    if (oy === 'auto' || oy === 'scroll') return true
  }
  return false
}

/**
 * Keyboard input.
 *
 * Movement is normalised so diagonals are not faster. Edge-triggered actions are
 * latched and cleared by their `consume*` reader, so one keypress is never handled
 * twice even when several fixed ticks run in a single frame.
 */
export class Input {
  /**
   * @param target Event source for the keyboard.
   * @param pads A function returning the connected gamepads, injected so the
   *   whole controller path is testable without a browser or a device — the
   *   same trick `Save` uses for localStorage.
   */
  constructor(target = window, pads = () => (typeof navigator === 'undefined' ? [] : navigator.getGamepads?.() ?? [])) {
    this.target = target
    this.pads = pads
    /**
     * Which device last said anything. Keyboard and pad both feed the same
     * fields, and without this a resting stick at 0.02 would fight a held key
     * every frame. Last input wins, which is what every game that supports both
     * does and what a player expects when they put the controller down.
     */
    this.source = 'keyboard'
    this._padX = 0
    this._padZ = 0
    this._padPrev = []
    this.down = new Set()
    this._dash = false
    this._pause = false
    this._confirm = false
    this._slot = 0
    this._debug = false
    this._quality = false
    this._mute = false
    this._x = 0
    this._z = 0

    this._onKeyDown = (e) => {
      if (e.repeat) return
      if (e.code in MOVE_KEYS || e.code === 'Space') e.preventDefault()
      this.down.add(e.code)
      if (e.code === 'Space') this._dash = true
      else if (e.code === 'KeyP' || e.code === 'Escape') this._pause = true
      else if (e.code === 'Enter') this._confirm = true
      else if (e.code === 'Digit1') this._slot = 1
      else if (e.code === 'Digit2') this._slot = 2
      else if (e.code === 'Digit3') this._slot = 3
      else if (e.code === 'F3') { e.preventDefault(); this._debug = true }
      else if (e.code === 'F4') { e.preventDefault(); this._quality = true }
      else if (e.code === 'KeyM') this._mute = true
      this._recompute()
    }
    this._onKeyUp = (e) => { this.down.delete(e.code); this._recompute() }
    this._onBlur = () => { this.down.clear(); this._recompute() }

    /**
     * Camera zoom, accumulated and drained once a frame.
     *
     * A wheel event can fire many times between frames, and trackpads send
     * dozens of small ones, so this sums deltas rather than counting events —
     * otherwise a trackpad flick would slam the camera to a limit.
     */
    this._zoomAccum = 0
    this._onWheel = (e) => {
      // The 단전 shop and the codex scroll. Zooming the camera out from under a
      // list the player is reading would be maddening, so a wheel that lands on
      // something scrollable belongs to that thing, not to us.
      if (scrollableUnder(e.target)) return
      e.preventDefault?.()
      // Wheel down (positive deltaY) pulls the camera out.
      this._zoomAccum += Math.sign(e.deltaY) * Math.min(1, Math.abs(e.deltaY) / 100)
    }

    target.addEventListener('keydown', this._onKeyDown)
    target.addEventListener('keyup', this._onKeyUp)
    target.addEventListener('blur', this._onBlur)
    target.addEventListener('wheel', this._onWheel, { passive: false })
  }

  /** Zoom steps requested since the last call. Positive = further out. */
  consumeZoom() {
    // Keys are read live rather than latched: holding one should keep zooming.
    let v = this._zoomAccum
    this._zoomAccum = 0
    if (this.down.has('Minus') || this.down.has('NumpadSubtract')) v += 0.14
    if (this.down.has('Equal') || this.down.has('NumpadAdd')) v -= 0.14
    return v
  }

  /** Recomputed on key change rather than per read, so `update` does no work. */
  _recompute() {
    let x = 0
    let z = 0
    for (const code of this.down) {
      const dir = MOVE_KEYS[code]
      if (dir === undefined) continue
      x += dir[0]
      z += dir[1]
    }
    const len = Math.hypot(x, z)
    if (len === 0) {
      this._x = 0
      this._z = 0
    } else {
      this._x = x / len
      this._z = z / len
    }
    if (len !== 0) this.source = 'keyboard'
  }

  /**
   * Read the first connected pad and latch its edges. Call once a frame.
   *
   * Buttons are edge-triggered into the same latches the keyboard writes, so
   * every `consume*` reader works unchanged and a press is never handled twice
   * when several fixed ticks run in one frame.
   *
   * The stick keeps its magnitude rather than being normalised: a gamepad can
   * walk, and taking that away would make it strictly worse than the keyboard
   * for threading a crowd. Diagonals are clamped to length 1 so it can never be
   * faster than one.
   */
  poll() {
    const pad = this._firstPad()
    if (!pad) return

    const ax = pad.axes?.[0] ?? 0
    const az = pad.axes?.[1] ?? 0
    const mag = Math.hypot(ax, az)
    if (mag > DEADZONE) {
      // Rescale so the deadzone edge is a standstill rather than a lurch to 0.18.
      const k = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE)) / mag
      this._padX = ax * k
      this._padZ = az * k
      this.source = 'gamepad'
    } else {
      this._padX = 0
      this._padZ = 0
    }

    const held = (i) => (pad.buttons?.[i]?.pressed ?? (pad.buttons?.[i]?.value ?? 0) > AXIS_PRESS)
    const pressed = (i) => {
      const now = held(i)
      const was = this._padPrev[i] ?? false
      this._padPrev[i] = now
      if (now && !was) this.source = 'gamepad'
      return now && !was
    }

    if (pressed(PAD.south) || pressed(PAD.r1)) { this._dash = true; this._confirm = true }
    if (pressed(PAD.start)) this._pause = true
    if (pressed(PAD.east)) this._confirm = true
    // D-pad drives menus through the same axis the menus already read.
    const dl = pressed(PAD.left)
    const dr = pressed(PAD.right)
    if (dl || dr) { this._padX = dl ? -1 : 1; this.source = 'gamepad' }
    // Keep the remaining edges warm so a later press is still an edge.
    pressed(PAD.up); pressed(PAD.down); pressed(PAD.west); pressed(PAD.north)
    pressed(PAD.l1); pressed(PAD.select)
  }

  _firstPad() {
    const list = this.pads() ?? []
    for (const p of list) if (p && p.connected !== false) return p
    return null
  }

  get moveX() { return this.source === 'gamepad' ? this._padX : this._x }
  get moveZ() { return this.source === 'gamepad' ? this._padZ : this._z }
  get hasMove() { return this.moveX !== 0 || this.moveZ !== 0 }
  /** True while a controller is the thing being used, for prompt glyphs. */
  get usingGamepad() { return this.source === 'gamepad' }

  consumeDash() { const v = this._dash; this._dash = false; return v }
  consumePause() { const v = this._pause; this._pause = false; return v }
  consumeConfirm() { const v = this._confirm; this._confirm = false; return v }
  consumeSlot() { const v = this._slot; this._slot = 0; return v }
  consumeDebug() { const v = this._debug; this._debug = false; return v }
  consumeQuality() { const v = this._quality; this._quality = false; return v }
  consumeMute() { const v = this._mute; this._mute = false; return v }

  dispose() {
    this.target.removeEventListener('keydown', this._onKeyDown)
    this.target.removeEventListener('keyup', this._onKeyUp)
    this.target.removeEventListener('blur', this._onBlur)
    this.target.removeEventListener('wheel', this._onWheel)
    this.down.clear()
  }
}
