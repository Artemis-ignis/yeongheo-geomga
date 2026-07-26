import { describe, it, expect } from 'vitest'
import { rollDamage, knockbackImpulse, mitigate } from '../src/combat/damage.js'
import { RNG } from '../src/core/RNG.js'

const stats = (over = {}) => ({
  might: 1, critChance: 0, critMult: 2,
  tagMight: { sword: 0, fire: 0, thunder: 0, ice: 0, array: 0 },
  ...over,
})

describe('rollDamage', () => {
  it('returns the raw damage at base stats with no crit', () => {
    const r = rollDamage(20, stats(), 'sword', new RNG(1))
    expect(r.amount).toBe(20)
    expect(r.crit).toBe(false)
  })

  it('scales with might', () => {
    expect(rollDamage(20, stats({ might: 1.5 }), 'sword', new RNG(1)).amount).toBe(30)
  })

  it('adds the matching tag bonus on top of might', () => {
    const s = stats({ tagMight: { sword: 0.5, fire: 0, thunder: 0, ice: 0, array: 0 } })
    expect(rollDamage(20, s, 'sword', new RNG(1)).amount).toBe(30)
  })

  it('ignores a tag bonus for a different tag', () => {
    const s = stats({ tagMight: { sword: 0.5, fire: 0, thunder: 0, ice: 0, array: 0 } })
    expect(rollDamage(20, s, 'fire', new RNG(1)).amount).toBe(20)
  })

  it('stacks might and the tag bonus', () => {
    const s = stats({ might: 1.5, tagMight: { sword: 0.5, fire: 0, thunder: 0, ice: 0, array: 0 } })
    expect(rollDamage(10, s, 'sword', new RNG(1)).amount).toBe(20)
  })

  it('multiplies by critMult on a crit', () => {
    const r = rollDamage(20, stats({ critChance: 1, critMult: 3 }), 'sword', new RNG(1))
    expect(r.crit).toBe(true)
    expect(r.amount).toBe(60)
  })

  it('rounds to a whole number', () => {
    const r = rollDamage(7, stats({ might: 1.13 }), 'sword', new RNG(1))
    expect(Number.isInteger(r.amount)).toBe(true)
  })

  it('never deals less than 1', () => {
    expect(rollDamage(0.01, stats({ might: 0.01 }), 'sword', new RNG(1)).amount).toBe(1)
  })

  it('is deterministic for a given seed', () => {
    const s = stats({ critChance: 0.5 })
    const a = Array.from({ length: 20 }, () => rollDamage(10, s, 'sword', new RNG(99)).crit)
    const b = Array.from({ length: 20 }, () => rollDamage(10, s, 'sword', new RNG(99)).crit)
    expect(a).toEqual(b)
  })

  it('crits at roughly the configured rate', () => {
    const rng = new RNG(2468)
    const s = stats({ critChance: 0.25 })
    let crits = 0
    for (let i = 0; i < 20000; i++) if (rollDamage(10, s, 'sword', rng).crit) crits++
    expect(crits / 20000).toBeGreaterThan(0.23)
    expect(crits / 20000).toBeLessThan(0.27)
  })

  it('handles an unknown tag as zero bonus', () => {
    expect(rollDamage(20, stats(), 'nonexistent', new RNG(1)).amount).toBe(20)
  })

  it('handles a stats object with no tagMight map', () => {
    const s = { might: 1, critChance: 0, critMult: 2 }
    expect(rollDamage(20, s, 'sword', new RNG(1)).amount).toBe(20)
  })
})

describe('knockbackImpulse', () => {
  it('passes force through at zero resist', () => {
    expect(knockbackImpulse(10, 0)).toBe(10)
  })

  it('scales down with resist', () => {
    expect(knockbackImpulse(10, 0.7)).toBeCloseTo(3, 6)
  })

  it('is zero at full resist', () => {
    expect(knockbackImpulse(10, 1)).toBe(0)
  })

  it('never goes negative for over-unity resist', () => {
    expect(knockbackImpulse(10, 1.5)).toBe(0)
  })
})

describe('mitigate', () => {
  it('subtracts flat armor', () => {
    expect(mitigate(10, 3)).toBe(7)
  })

  it('floors at 1 damage', () => {
    expect(mitigate(4, 99)).toBe(1)
  })

  it('is a no-op at zero armor', () => {
    expect(mitigate(12, 0)).toBe(12)
  })
})
