import { describe, it, expect } from 'vitest'
import { validateData } from '../src/data/validate.js'
import { WEAPONS, EVOLUTIONS, getWeapon } from '../src/data/weapons.js'
import { PASSIVES } from '../src/data/passives.js'
import { CHARACTERS, TAGS } from '../src/data/characters.js'
import { realmFor, xpFor } from '../src/data/realms.js'
import { ENEMIES, getEnemy, scaledHp, scaledDamage, scaledXp } from '../src/data/enemies.js'
import { WEAPON_MODULES, getWeaponModule } from '../src/combat/weapons/index.js'

describe('data validation', () => {
  it('passes on the shipped tables', () => {
    expect(() => validateData()).not.toThrow()
  })

  it('ships a meaningful weapon pool with evolutions for part of it', () => {
    expect(WEAPONS.length).toBeGreaterThanOrEqual(8)
    expect(EVOLUTIONS.length).toBeGreaterThanOrEqual(4)
    // Every evolution comes from a distinct base weapon, so there cannot be more.
    expect(EVOLUTIONS.length).toBeLessThanOrEqual(WEAPONS.length)
  })

  it('gives each evolution a distinct parent', () => {
    const parents = EVOLUTIONS.map((e) => e.evolutionOf)
    expect(new Set(parents).size).toBe(parents.length)
  })

  it('pairs each evolving weapon with a distinct 공법', () => {
    const pairs = WEAPONS.filter((w) => w.evolvesTo).map((w) => w.pairPassive)
    expect(new Set(pairs).size, 'two weapons share a pair passive').toBe(pairs.length)
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
    expect(CHARACTERS.length).toBeGreaterThanOrEqual(3)
    for (const c of CHARACTERS) expect(getWeapon(c.startWeapon)).toBeDefined()
  })

  it('gives every character a different starting weapon', () => {
    const starts = CHARACTERS.map((c) => c.startWeapon)
    expect(new Set(starts).size).toBe(CHARACTERS.length)
  })

  it('has a behaviour module for every weapon and evolution', () => {
    for (const w of [...WEAPONS, ...EVOLUTIONS]) {
      const module = getWeaponModule(w.id)
      expect(module, `no module for "${w.id}"`).toBeDefined()
      // A weapon must do something: fire on a cadence, or run continuously.
      expect(
        typeof module.fire === 'function' || typeof module.update === 'function',
        `"${w.id}" has neither fire nor update`,
      ).toBe(true)
    }
  })

  it('pairs attach with detach so persistent weapons cannot leak meshes', () => {
    for (const w of [...WEAPONS, ...EVOLUTIONS]) {
      const module = getWeaponModule(w.id)
      expect(
        Boolean(module.attach) === Boolean(module.detach),
        `"${w.id}" has attach without detach (or vice versa)`,
      ).toBe(true)
    }
  })

  it('exposes no modules for weapons that are not in the data tables', () => {
    const known = new Set([...WEAPONS, ...EVOLUTIONS].map((w) => w.id))
    for (const id of Object.keys(WEAPON_MODULES)) {
      expect(known.has(id), `module "${id}" has no data entry`).toBe(true)
    }
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
