import { describe, it, expect } from 'vitest'
import { validateData } from '../src/data/validate.js'
import { WEAPONS, EVOLUTIONS, getWeapon } from '../src/data/weapons.js'
import { PASSIVES } from '../src/data/passives.js'
import { CHARACTERS, TAGS } from '../src/data/characters.js'
import { realmFor, xpFor } from '../src/data/realms.js'
import { ENEMIES, getEnemy, scaledHp, scaledDamage, scaledXp } from '../src/data/enemies.js'

describe('data validation', () => {
  it('passes on the shipped tables', () => {
    expect(() => validateData()).not.toThrow()
  })

  it('ships 8 base weapons and 4 evolutions', () => {
    expect(WEAPONS).toHaveLength(8)
    expect(EVOLUTIONS).toHaveLength(4)
  })

  it('gives every base weapon exactly 5 levels', () => {
    for (const w of WEAPONS) expect(w.levels).toHaveLength(5)
  })

  it('gives every evolution exactly 1 level', () => {
    for (const w of EVOLUTIONS) expect(w.levels).toHaveLength(1)
  })

  it('uses only known tags', () => {
    for (const w of [...WEAPONS, ...EVOLUTIONS]) expect(TAGS).toContain(w.tag)
  })

  it('links evolutions to a real weapon and passive in both directions', () => {
    for (const w of WEAPONS) {
      if (!w.evolvesTo) continue
      const evo = getWeapon(w.evolvesTo)
      expect(evo).toBeDefined()
      expect(evo.evolutionOf).toBe(w.id)
      expect(PASSIVES.some((p) => p.id === w.pairPassive)).toBe(true)
    }
  })

  it('makes every weapon level strictly stronger than the last', () => {
    for (const w of WEAPONS) {
      for (let i = 1; i < w.levels.length; i++) {
        expect(w.levels[i].damage).toBeGreaterThan(w.levels[i - 1].damage)
      }
    }
  })

  it('ships 6 passives, all capped at 5', () => {
    expect(PASSIVES).toHaveLength(6)
    for (const p of PASSIVES) expect(p.max).toBe(5)
  })

  it('gives every character a real starting weapon', () => {
    expect(CHARACTERS).toHaveLength(3)
    for (const c of CHARACTERS) expect(getWeapon(c.startWeapon)).toBeDefined()
  })

  it('gives the three characters three different starting weapons', () => {
    const starts = CHARACTERS.map((c) => c.startWeapon)
    expect(new Set(starts).size).toBe(3)
  })
})

describe('realms', () => {
  it('maps every level to a realm', () => {
    for (let lv = 1; lv <= 40; lv++) expect(realmFor(lv).name).toBeTruthy()
  })

  it('names the boundaries correctly', () => {
    expect(realmFor(1).name).toBe('연기')
    expect(realmFor(4).name).toBe('연기')
    expect(realmFor(5).name).toBe('축기')
    expect(realmFor(9).name).toBe('축기')
    expect(realmFor(10).name).toBe('결단')
    expect(realmFor(30).name).toBe('대승')
    expect(realmFor(99).name).toBe('대승')
  })

  it('makes each level cost more than the last', () => {
    for (let lv = 1; lv < 40; lv++) expect(xpFor(lv + 1)).toBeGreaterThan(xpFor(lv))
    expect(xpFor(1)).toBeGreaterThan(0)
  })
})

describe('enemy scaling', () => {
  it('looks up by id', () => {
    expect(getEnemy('wolf').name).toBe('요랑')
    expect(getEnemy('nope')).toBeUndefined()
  })

  it('leaves stats unscaled at time zero', () => {
    const e = ENEMIES[0]
    expect(scaledHp(e, 0)).toBe(e.hp)
    expect(scaledDamage(e, 0)).toBe(e.damage)
    expect(scaledXp(e, 0)).toBe(e.xp)
  })

  it('grows HP faster than damage over the run', () => {
    const e = getEnemy('wolf')
    const hpRatio = scaledHp(e, 15) / e.hp
    const dmgRatio = scaledDamage(e, 15) / e.damage
    expect(hpRatio).toBeGreaterThan(dmgRatio)
  })

  it('makes the 15-minute horde meaningfully tougher', () => {
    const e = getEnemy('wisp')
    expect(scaledHp(e, 15) / e.hp).toBeGreaterThan(9)
  })

  it('returns whole numbers of XP', () => {
    for (const e of ENEMIES) {
      expect(Number.isInteger(scaledXp(e, 7.5))).toBe(true)
    }
  })
})
