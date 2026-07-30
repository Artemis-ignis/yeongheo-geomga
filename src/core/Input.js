const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
}

/**
 * Keyboard input.
 *
 * Movement is normalised so diagonals are not faster. Edge-triggered actions are
 * latched and cleared by their `consume*` reader, so one keypress is never handled
 * twice even when several fixed ticks run in a single frame.
 */
export class Input {
  constructor(target = window) {
    this.target = target
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

    target.addEventListener('keydown', this._onKeyDown)
    target.addEventListener('keyup', this._onKeyUp)
    target.addEventListener('blur', this._onBlur)
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
  }

  get moveX() { return this._x }
  get moveZ() { return this._z }
  get hasMove() { return this._x !== 0 || this._z !== 0 }

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
    this.down.clear()
  }
}
