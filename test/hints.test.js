import { describe, it, expect } from 'vitest'
import { HINTS, nextHint } from '../src/data/hints.js'

/** A state where nothing has happened yet. */
function fresh(over = {}) {
  return {
    runTime: 0, level: 1, kills: 0, stones: 0, hpFraction: 1,
    qiOnGround: 0, nearbyEnemies: 0, bossAlive: false, ...over,
  }
}

describe('hint table', () => {
  it('has unique ids', () => {
    const ids = HINTS.map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every hint text and a readable dwell', () => {
    for (const h of HINTS) {
      expect(h.text.length, `"${h.id}" has no text`).toBeGreaterThan(4)
      // Long enough to read a Korean sentence, short enough not to linger.
      expect(h.hold).toBeGreaterThanOrEqual(3)
      expect(h.hold).toBeLessThanOrEqual(7)
    }
  })
})

describe('hint sequencing', () => {
  it('opens with the controls before anything else can fire', () => {
    expect(nextHint(fresh(), new Set()).id).toBe('move')
  })

  it('never repeats one that has been shown', () => {
    const shown = new Set(['move'])
    expect(nextHint(fresh(), shown)?.id).not.toBe('move')
  })

  it('stays silent when nothing has been triggered', () => {
    const quiet = fresh({ runTime: 10 })
    const shown = new Set(HINTS.map((h) => h.id))
    expect(nextHint(quiet, shown)).toBeNull()
  })

  it('explains the level-up choice only once a level has actually landed', () => {
    const shown = new Set(['move', 'auto', 'qi'])
    expect(nextHint(fresh({ runTime: 30, level: 1 }), shown)?.id).not.toBe('levelUp')
    expect(nextHint(fresh({ runTime: 30, level: 2 }), shown)?.id).toBe('levelUp')
  })

  it('warns about being surrounded only when actually surrounded', () => {
    const shown = new Set(HINTS.filter((h) => h.id !== 'crowd').map((h) => h.id))
    expect(nextHint(fresh({ nearbyEnemies: 4 }), shown)).toBeNull()
    expect(nextHint(fresh({ nearbyEnemies: 20 }), shown)?.id).toBe('crowd')
  })

  it('mentions 영석 only after some have dropped', () => {
    const shown = new Set(HINTS.filter((h) => h.id !== 'stone').map((h) => h.id))
    expect(nextHint(fresh({ stones: 0 }), shown)).toBeNull()
    expect(nextHint(fresh({ stones: 40 }), shown)?.id).toBe('stone')
  })

  it('drains to nothing over a run rather than looping forever', () => {
    const shown = new Set()
    // A generous run that trips every condition at some point.
    const states = [
      fresh(), fresh({ runTime: 6, kills: 3 }), fresh({ runTime: 8, qiOnGround: 9 }),
      fresh({ runTime: 15, level: 3 }), fresh({ runTime: 30 }),
      fresh({ runTime: 60, nearbyEnemies: 30 }), fresh({ runTime: 90, hpFraction: 0.2 }),
      fresh({ runTime: 120, stones: 90 }), fresh({ runTime: 480, bossAlive: true }),
    ]
    let fired = 0
    for (const s of states) {
      let h
      // Several can be ready at once; the overlay takes one per gap.
      while ((h = nextHint(s, shown)) !== null) { shown.add(h.id); fired++ }
    }
    expect(fired).toBe(HINTS.length)
    expect(nextHint(fresh({ runTime: 900, bossAlive: true }), shown)).toBeNull()
  })
})
