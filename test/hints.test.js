import { describe, it, expect } from 'vitest'
import { HINTS, nextHint, particle } from '../src/data/hints.js'
import { WEAPONS, EVOLUTIONS } from '../src/data/weapons.js'
import { PASSIVES } from '../src/data/passives.js'

/** A state where nothing has happened yet. */
function fresh(over = {}) {
  return {
    runTime: 0, level: 1, kills: 0, stones: 0, hpFraction: 1,
    qiOnGround: 0, nearbyEnemies: 0, bossAlive: false,
    formationSeen: false, maxedWeapon: null, ...over,
  }
}

/** Everything a hint could ask about, all true at once. */
const everything = () => fresh({
  runTime: 900, level: 40, kills: 500, stones: 900, hpFraction: 0.1,
  qiOnGround: 40, nearbyEnemies: 60, bossAlive: true, formationSeen: true,
  maxedWeapon: { weapon: '비검', passive: '검결' },
})

const textOf = (hint, state) => (typeof hint.text === 'function' ? hint.text(state) : hint.text)

describe('hint table', () => {
  it('has unique ids', () => {
    const ids = HINTS.map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every hint text and a readable dwell', () => {
    const state = everything()
    for (const h of HINTS) {
      expect(textOf(h, state).length, `"${h.id}" has no text`).toBeGreaterThan(4)
      // Long enough to read a Korean sentence, short enough not to linger.
      expect(h.hold).toBeGreaterThanOrEqual(3)
      expect(h.hold).toBeLessThanOrEqual(7)
    }
  })

  it('names the pair in the evolution hint rather than stating a rule', () => {
    // "비검 is waiting on 검결" is a thing to do next; "pair a maxed 법보 with
    // its 공법" is a thing to memorise.
    const hint = HINTS.find((h) => h.id === 'evolve')
    const text = textOf(hint, everything())
    expect(text).toContain('비검')
    expect(text).toContain('검결')
    // And it is written, not templated: no 이(가) placeholders on screen.
    expect(text).not.toContain('(')
  })

  it('keeps the evolution hint out of the onboarding retirement', () => {
    /**
     * Every other hint stops firing after a couple of runs, which is right for
     * "WASD moves you". Evolutions are not that: measured over eight fresh-save
     * runs they decide the outcome outright, and nothing in the game says the
     * pairing exists. A player who has not yet reached a maxed 법보 is exactly
     * the one who needs it, and they may well be on run five.
     */
    expect(HINTS.find((h) => h.id === 'evolve').always).toBe(true)
    for (const h of HINTS.filter((x) => x.id !== 'evolve')) {
      expect(h.always, `"${h.id}" escapes onboarding retirement`).toBeFalsy()
    }
  })

  it('honours the gate the overlay passes in', () => {
    const onlyAlways = (h) => h.always === true
    const hint = nextHint(everything(), new Set(), onlyAlways)
    expect(hint?.id).toBe('evolve')
  })
})

describe('Korean particles', () => {
  /**
   * The slashed form 이(가) is what you write in a spec when the word is not
   * known yet. Every name this picks between is known at runtime, so choosing
   * is arithmetic on the Hangul block rather than a hard problem.
   */
  it('follows the final consonant', () => {
    // 검 and 단 end in a consonant; 부 and 진 do not / do.
    expect(particle('비검', '이', '가')).toBe('이')
    expect(particle('금단', '을', '를')).toBe('을')
    expect(particle('화염부', '이', '가')).toBe('가')
    expect(particle('뇌령주', '을', '를')).toBe('를')
  })

  it('handles every 법보 and 공법 name the game can show', () => {
    for (const name of [...WEAPONS, ...EVOLUTIONS].map((w) => w.name).concat(PASSIVES.map((p) => p.name))) {
      const p = particle(name, '이', '가')
      expect(['이', '가'], `"${name}" produced "${p}"`).toContain(p)
    }
  })

  it('falls back rather than throwing on something that is not Hangul', () => {
    expect(() => particle('', '이', '가')).not.toThrow()
    expect(particle('Bagua', '이', '가')).toBe('이')
    expect(particle(undefined, '을', '를')).toBe('을')
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
      fresh({ runTime: 500, formationSeen: true }),
      fresh({ runTime: 520, maxedWeapon: { weapon: '비검', passive: '검결' } }),
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
