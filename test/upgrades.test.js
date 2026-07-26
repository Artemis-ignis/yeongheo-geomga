import { describe, it, expect } from 'vitest'
import {
  rollUpgrades, applyChoice, canEvolve,
  MAX_WEAPON_SLOTS, MAX_PASSIVE_SLOTS,
} from '../src/combat/upgrades.js'
import { WEAPONS, EVOLUTIONS, getWeapon } from '../src/data/weapons.js'
import { PASSIVES } from '../src/data/passives.js'
import { RNG } from '../src/core/RNG.js'

const stats = { luck: 1 }
const loadout = (weapons = {}, passives = {}) => ({ weapons: { ...weapons }, passives: { ...passives } })

describe('rollUpgrades', () => {
  it('offers exactly three choices', () => {
    expect(rollUpgrades(loadout({ flyingSword: 1 }), stats, new RNG(1))).toHaveLength(3)
  })

  it('offers distinct choices', () => {
    for (let seed = 0; seed < 50; seed++) {
      const ids = rollUpgrades(loadout({ flyingSword: 1 }), stats, new RNG(seed)).map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('never offers a weapon that is already at max level', () => {
    const lo = loadout({ flyingSword: 5 })
    for (let seed = 0; seed < 100; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed))) {
        if (c.kind === 'weapon') expect(c.id).not.toBe('flyingSword')
      }
    }
  })

  it('never offers a passive that is already at max level', () => {
    const lo = loadout({ flyingSword: 1 }, { swordArt: 5 })
    for (let seed = 0; seed < 100; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed))) {
        if (c.kind === 'passive') expect(c.id).not.toBe('swordArt')
      }
    }
  })

  it('never offers a new weapon once the weapon slots are full', () => {
    const weapons = {}
    for (const w of WEAPONS.slice(0, MAX_WEAPON_SLOTS)) weapons[w.id] = 1
    const lo = loadout(weapons)
    const owned = new Set(Object.keys(weapons))
    for (let seed = 0; seed < 100; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed))) {
        if (c.kind === 'weapon') expect(owned.has(c.id)).toBe(true)
      }
    }
  })

  it('never offers a new passive once the passive slots are full', () => {
    const passives = {}
    for (const p of PASSIVES.slice(0, MAX_PASSIVE_SLOTS)) passives[p.id] = 1
    const lo = loadout({ flyingSword: 1 }, passives)
    const owned = new Set(Object.keys(passives))
    for (let seed = 0; seed < 100; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed))) {
        if (c.kind === 'passive') expect(owned.has(c.id)).toBe(true)
      }
    }
  })

  it('offers the evolution when the weapon and its pair passive are both maxed', () => {
    const lo = loadout({ flyingSword: 5 }, { swordArt: 5 })
    const offered = rollUpgrades(lo, stats, new RNG(7))
    expect(offered.some((c) => c.kind === 'evolution' && c.id === 'myriadSwords')).toBe(true)
  })

  it('marks the evolution with the weapon it replaces', () => {
    const lo = loadout({ frostPalm: 5 }, { guardianAura: 5 })
    const evo = rollUpgrades(lo, stats, new RNG(21)).find((c) => c.kind === 'evolution')
    expect(evo.id).toBe('frozenSky')
    expect(evo.replaces).toBe('frostPalm')
  })

  it('does not offer an evolution the player already owns', () => {
    const lo = loadout({ myriadSwords: 1 }, { swordArt: 5 })
    for (let seed = 0; seed < 50; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed))) {
        expect(c.id).not.toBe('myriadSwords')
      }
    }
  })

  it('falls back to consumables when everything is maxed', () => {
    const weapons = {}
    for (const w of WEAPONS.slice(0, MAX_WEAPON_SLOTS)) weapons[w.id] = 5
    const passives = {}
    for (const p of PASSIVES) passives[p.id] = 5
    const offered = rollUpgrades(loadout(weapons, passives), stats, new RNG(3))
    expect(offered).toHaveLength(3)
    for (const c of offered) expect(c.kind === 'evolution' || c.kind === 'consumable').toBe(true)
  })

  it('always returns three even for a totally empty loadout', () => {
    expect(rollUpgrades(loadout(), stats, new RNG(5))).toHaveLength(3)
  })

  it('reports the level transition on an upgrade', () => {
    const offered = rollUpgrades(loadout({ flyingSword: 2 }), stats, new RNG(11))
    const sword = offered.find((c) => c.id === 'flyingSword')
    if (sword) {
      expect(sword.fromLevel).toBe(2)
      expect(sword.toLevel).toBe(3)
    }
  })

  it('marks a brand new item as coming from level 0', () => {
    const offered = rollUpgrades(loadout(), stats, new RNG(13))
    for (const c of offered) expect(c.fromLevel).toBe(0)
  })

  it('is deterministic for a given seed', () => {
    const lo = loadout({ flyingSword: 1 }, { swordArt: 1 })
    const a = rollUpgrades(lo, stats, new RNG(4242)).map((c) => c.id)
    const b = rollUpgrades(lo, stats, new RNG(4242)).map((c) => c.id)
    expect(a).toEqual(b)
  })

  it('does not mutate the loadout it was given', () => {
    const lo = loadout({ flyingSword: 1 }, { swordArt: 1 })
    const before = JSON.stringify(lo)
    rollUpgrades(lo, stats, new RNG(1))
    expect(JSON.stringify(lo)).toBe(before)
  })
})

describe('canEvolve', () => {
  const sword = getWeapon('flyingSword')

  it('is false when only the weapon is maxed', () => {
    expect(canEvolve(loadout({ flyingSword: 5 }), sword)).toBe(false)
  })

  it('is false when only the passive is maxed', () => {
    expect(canEvolve(loadout({ flyingSword: 1 }, { swordArt: 5 }), sword)).toBe(false)
  })

  it('is true when both are maxed', () => {
    expect(canEvolve(loadout({ flyingSword: 5 }, { swordArt: 5 }), sword)).toBe(true)
  })

  it('is false for a weapon with no evolution', () => {
    expect(canEvolve(loadout({ baguaArray: 5 }, { swordArt: 5 }), getWeapon('baguaArray'))).toBe(false)
  })

  it('is false for a missing weapon', () => {
    expect(canEvolve(loadout(), undefined)).toBe(false)
  })
})

describe('applyChoice', () => {
  it('adds a new weapon at level 1', () => {
    const lo = loadout()
    applyChoice(lo, { kind: 'weapon', id: 'vajra', toLevel: 1 })
    expect(lo.weapons.vajra).toBe(1)
  })

  it('raises an owned weapon to the target level', () => {
    const lo = loadout({ vajra: 2 })
    applyChoice(lo, { kind: 'weapon', id: 'vajra', toLevel: 3 })
    expect(lo.weapons.vajra).toBe(3)
  })

  it('raises a passive', () => {
    const lo = loadout({}, { swordArt: 1 })
    applyChoice(lo, { kind: 'passive', id: 'swordArt', toLevel: 2 })
    expect(lo.passives.swordArt).toBe(2)
  })

  it('replaces the base weapon when evolving', () => {
    const lo = loadout({ flyingSword: 5 }, { swordArt: 5 })
    const evo = EVOLUTIONS.find((e) => e.id === 'myriadSwords')
    applyChoice(lo, { kind: 'evolution', id: evo.id, replaces: evo.evolutionOf, toLevel: 1 })
    expect(lo.weapons.flyingSword).toBeUndefined()
    expect(lo.weapons.myriadSwords).toBe(1)
  })

  it('keeps the weapon slot count the same across an evolution', () => {
    const lo = loadout({ flyingSword: 5, vajra: 2 }, { swordArt: 5 })
    applyChoice(lo, { kind: 'evolution', id: 'myriadSwords', replaces: 'flyingSword', toLevel: 1 })
    expect(Object.keys(lo.weapons)).toHaveLength(2)
  })

  it('leaves the loadout untouched for a consumable', () => {
    const lo = loadout({ vajra: 1 })
    applyChoice(lo, { kind: 'consumable', id: 'heal' })
    expect(lo.weapons).toEqual({ vajra: 1 })
  })
})
