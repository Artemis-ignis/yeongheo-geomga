import { nextHint } from '../data/hints.js'

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

  update(dt, state) {
    if (this.current) {
      this.timer -= dt
      if (this.timer <= 0) {
        this.current = null
        this.cooldown = 1.1
        this.node.style.opacity = '0'
      }
      return
    }

    if (this.cooldown > 0) {
      this.cooldown -= dt
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
    this.node.style.opacity = '0'
  }

  dispose() {
    this.node.remove()
  }
}
