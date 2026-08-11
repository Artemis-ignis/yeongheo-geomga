import { nextHint } from '../data/hints.js'

const MOVE_HINT_ID = 'move'
const MOVE_HINT_MAX_SECONDS = 8

/**
 * First-run hints, shown one at a time above the health bar.
 *
 * Deliberately not a tutorial mode: nothing is gated, nothing is paused, and
 * there is no dialog to dismiss. A bullet-heaven's whole appeal is that it
 * starts instantly, and a modal wall of instructions in front of that is worse
 * than saying nothing. These fade in, sit for a few seconds and leave.
 *
 * Each fires once per save rather than once per run. A player on their fourth
 * attempt is not being introduced to anything.
 */
export class HintOverlay {
  constructor(root, progress) {
    this.progress = progress
    this.node = document.createElement('div')
    this.node.className = 'hint-line'
    this.node.style.opacity = '0'
    root.appendChild(this.node)

    this.shown = new Set(progress.state?.hintsSeen ?? [])
    this.timer = 0
    this.current = null
    // A gap after one hint clears, so two triggers landing together do not read
    // as a wall of text.
    this.cooldown = 0
    this.runSeconds = 0
    this.lastRunTime = null
  }

  /**
   * Nothing to teach a player who has finished runs before — with one exception.
   *
   * `always` hints are not onboarding. They are rules the game never states
   * anywhere and that a player cannot deduce by playing, and the pairing that
   * unlocks an evolution is the only one: a 법보 at its cap looks finished, and
   * measured over eight runs, whether an evolution happens is what separates
   * dying at four minutes from surviving fourteen. Gating that behind "your
   * first two runs" would hide it from exactly the player who has not reached a
   * maxed 법보 yet.
   */
  _isOpen(hint) {
    if (hint.always) return true
    return (this.progress.records?.runs ?? 0) < 2
  }

  _dismissMoveHint() {
    if (this.current?.id !== MOVE_HINT_ID) return false
    this.current = null
    this.timer = 0
    this.cooldown = 1.1
    this.node.style.opacity = '0'
    return true
  }

  /**
   * Acknowledge activity without dismissing the opening control strip.
   *
   * Older callers used this hook to close the movement hint on the first key
   * press. Keep the hook source-compatible, but the first input is precisely
   * when the player needs the controls most, so it must not hide the strip.
   */
  notifyActivity() {
    return false
  }

  update(dt, state) {
    const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0
    const runTime = Number(state?.runTime)
    if (Number.isFinite(runTime)) {
      if (this.lastRunTime !== null && runTime + 0.25 < this.lastRunTime) this.runSeconds = 0
      this.lastRunTime = runTime
      this.runSeconds = Math.max(this.runSeconds, Math.max(0, runTime))
    } else {
      this.runSeconds += delta
    }

    if (this.current?.id === MOVE_HINT_ID && this.runSeconds >= MOVE_HINT_MAX_SECONDS) {
      this._dismissMoveHint()
      return
    }

    if (this.current) {
      this.timer -= delta
      if (this.timer <= 0) {
        this.current = null
        this.cooldown = 1.1
        this.node.style.opacity = '0'
      }
      return
    }

    if (this.cooldown > 0) {
      this.cooldown -= delta
      return
    }

    const hint = nextHint(state, this.shown, (h) => this._isOpen(h))
    if (!hint) return
    this.shown.add(hint.id)
    this.current = hint
    this.timer = hint.hold
    // A hint may name what it is about — "비검 is waiting on 검결" is a thing to
    // do next, where a generic rule is a thing to memorise.
    this.node.textContent = typeof hint.text === 'function' ? hint.text(state) : hint.text
    this.node.style.opacity = '1'
  }

  /** Folded into the save so hints do not reappear next session. */
  persistInto(state) {
    state.hintsSeen = [...this.shown]
  }

  hide() {
    this.current = null
    this.timer = 0
    this.cooldown = 0
    this.node.style.opacity = '0'
  }

  dispose() {
    this.node.remove()
  }
}
