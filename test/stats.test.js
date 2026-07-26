import { describe, it, expect } from 'vitest'
import { computeStats, applyMaxHpChange, COOLDOWN_FLOOR } from '../src/combat/Stats.js'
import { BASE_STATS, getCharacter } from '../src/data/characters.js'

const plain = { id: 'test', name: 't', startWeapon: 'flyingSword', mods: [] }

describe('computeStats', () => {
  it('returns base stats for a character with no mods and no passives', () => {
    const s = computeStats(plain, {})
    for (const key of Object.keys(BASE_STATS)) expect(s[key]).toBe(BASE_STATS[key])
  })

  it('starts every tag at zero bonus', () => {
    const s = computeStats(plain, {})
    expect(s.tagMight.sword).toBe(0)
    expect(s.tagMight.fire).toBe(0)
    expect(s.tagMight.array).toBe(0)
  })

  it('adds additive stats linearly', () => {
    expect(computeStats(plain, { swordArt: 3 }).might).toBeCloseTo(1.3, 6)
  })

  it('applies multiplicative stats as a product', () => {
    const s = computeStats(plain, { lightBody: 2 })
    expect(s.moveSpeed).toBeCloseTo(BASE_STATS.moveSpeed * 1.08 * 1.08, 6)
  })

  it('stacks a character mod with a passive on the same stat', () => {
    const s = computeStats(getCharacter('seolryeong'), { lightBody: 1 })
    expect(s.moveSpeed).toBeCloseTo(BASE_STATS.moveSpeed * 1.1 * 1.08, 6)
  })

  it('routes tagMight mods to the right tag only', () => {
    const s = computeStats(getCharacter('seolryeong'), {})
    expect(s.tagMight.sword).toBeCloseTo(0.15, 6)
    expect(s.tagMight.fire).toBe(0)
  })

  it('gives 홍련 a fire bonus and an area bonus', () => {
    const s = computeStats(getCharacter('hongryeon'), {})
    expect(s.tagMight.fire).toBeCloseTo(0.25, 6)
    expect(s.area).toBeCloseTo(1.15, 6)
  })

  it('gives 청묘 more max HP and regeneration', () => {
    const s = computeStats(getCharacter('cheongmyo'), {})
    expect(s.maxHp).toBeCloseTo(BASE_STATS.maxHp * 1.3, 6)
    expect(s.regen).toBeCloseTo(0.4, 6)
  })

  it('reduces cooldown additively', () => {
    expect(computeStats(plain, { spiritRoot: 3 }).cooldown).toBeCloseTo(0.76, 6)
  })

  it('caps 영근 alone at 40% cooldown reduction, above the floor', () => {
    expect(computeStats(plain, { spiritRoot: 5 }).cooldown).toBeCloseTo(0.6, 6)
  })

  it('clamps cooldown at the floor when something pushes it lower', () => {
    const speedy = { id: 'speedy', mods: [{ stat: 'cooldown', op: 'add', value: -0.5 }] }
    const s = computeStats(speedy, { spiritRoot: 5 })
    expect(s.cooldown).toBe(COOLDOWN_FLOOR)
  })

  it('never lets cooldown reach zero no matter how much reduction stacks', () => {
    const absurd = { id: 'absurd', mods: [{ stat: 'cooldown', op: 'add', value: -99 }] }
    expect(computeStats(absurd, {}).cooldown).toBe(COOLDOWN_FLOOR)
  })

  it('applies both mods of a multi-mod passive', () => {
    const s = computeStats(plain, { guardianAura: 2 })
    expect(s.maxHp).toBeCloseTo(BASE_STATS.maxHp * 1.15 * 1.15, 4)
    expect(s.armor).toBe(2)
  })

  it('ignores passives at level 0', () => {
    expect(computeStats(plain, { swordArt: 0 }).might).toBe(BASE_STATS.might)
  })

  it('ignores unknown passive ids', () => {
    expect(() => computeStats(plain, { nonsense: 3 })).not.toThrow()
    expect(computeStats(plain, { nonsense: 3 }).might).toBe(BASE_STATS.might)
  })

  it('is pure — repeated calls give identical results', () => {
    const a = computeStats(getCharacter('cheongmyo'), { goldenCore: 4 })
    const b = computeStats(getCharacter('cheongmyo'), { goldenCore: 4 })
    expect(a).toEqual(b)
  })

  it('does not drift when recomputed from an already-built loadout', () => {
    const levels = { swordArt: 5, lightBody: 5, guardianAura: 5, spiritRoot: 5, farSight: 5, goldenCore: 5 }
    const once = computeStats(getCharacter('seolryeong'), levels)
    const twice = computeStats(getCharacter('seolryeong'), levels)
    expect(once).toEqual(twice)
  })
})

describe('applyMaxHpChange', () => {
  it('preserves the HP fraction when max HP rises', () => {
    expect(applyMaxHpChange(50, 100, 200)).toBe(100)
  })

  it('preserves the HP fraction when max HP falls', () => {
    expect(applyMaxHpChange(80, 100, 50)).toBe(40)
  })

  it('keeps a full-health character at full health', () => {
    expect(applyMaxHpChange(100, 100, 130)).toBe(130)
  })

  it('is a no-op when the old max is zero', () => {
    expect(applyMaxHpChange(0, 0, 100)).toBe(100)
  })
})
