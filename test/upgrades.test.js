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

  /**
   * The gate that decided every run, and had no test at all.
   *
   * It used to need the paired 공법 maxed as well as the 법보 — ten correct
   * picks out of random three-card draws, against the twenty-odd a first run
   * sees. Measured over eight fresh-save runs it fired zero times, and runs
   * split cleanly into "no evolution, dead at four minutes" and "three
   * evolutions, alive at fourteen" with nothing in between.
   */
  it('needs only the pair 공법 owned, not maxed', () => {
    expect(canEvolve(loadout({ flyingSword: 5 }, { swordArt: 1 }), getWeapon('flyingSword'))).toBe(true)
    const offered = rollUpgrades(loadout({ flyingSword: 5 }, { swordArt: 1 }), stats, new RNG(7))
    expect(offered.some((c) => c.kind === 'evolution' && c.id === 'myriadSwords')).toBe(true)
  })

  it('still needs the 법보 itself maxed', () => {
    for (let level = 0; level < 5; level++) {
      const lo = loadout({ flyingSword: level }, { swordArt: 5 })
      expect(canEvolve(lo, getWeapon('flyingSword')), `evolved from level ${level}`).toBe(false)
    }
  })

  it('still needs the pair 공법 at all', () => {
    expect(canEvolve(loadout({ flyingSword: 5 }, {}), getWeapon('flyingSword'))).toBe(false)
  })

  it('gates every evolution on its own pair, not on any 공법', () => {
    // A full set of the wrong 공법 must not unlock anything.
    for (const w of WEAPONS.filter((x) => x.evolvesTo && x.pairPassive)) {
      const wrong = {}
      for (const p of PASSIVES) if (p.id !== w.pairPassive) wrong[p.id] = p.max
      expect(canEvolve(loadout({ [w.id]: 5 }, wrong), w), `${w.id} evolved on the wrong pair`).toBe(false)
    }
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

  it('never offers a weapon that is not unlocked', () => {
    const unlocked = ['flyingSword', 'baguaArray']
    for (let seed = 0; seed < 100; seed++) {
      for (const c of rollUpgrades(loadout(), stats, new RNG(seed), 3, unlocked)) {
        if (c.kind === 'weapon') expect(unlocked).toContain(c.id)
      }
    }
  })

  it('offers a weapon once it is unlocked', () => {
    const lo = loadout()
    let sawVajra = false
    for (let seed = 0; seed < 120 && !sawVajra; seed++) {
      const offered = rollUpgrades(lo, stats, new RNG(seed), 3, ['flyingSword', 'vajra'])
      sawVajra = offered.some((c) => c.id === 'vajra')
    }
    expect(sawVajra).toBe(true)
  })

  it('hides the evolution of a locked weapon', () => {
    const lo = loadout({ frostPalm: 5 }, { guardianAura: 5 })
    for (let seed = 0; seed < 60; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed), 3, ['flyingSword'])) {
        expect(c.id).not.toBe('frozenSky')
      }
    }
  })

  it('still fills three slots when almost everything is locked', () => {
    for (let seed = 0; seed < 30; seed++) {
      expect(rollUpgrades(loadout(), stats, new RNG(seed), 3, ['flyingSword'])).toHaveLength(3)
    }
  })

  it('offers everything when no unlock list is given', () => {
    const ids = new Set()
    for (let seed = 0; seed < 200; seed++) {
      for (const c of rollUpgrades(loadout(), stats, new RNG(seed))) ids.add(c.id)
    }
    expect(ids.has('vajra')).toBe(true)
    expect(ids.has('skyThunder')).toBe(true)
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

describe('banish', () => {
  const stats = { luck: 1 }

  it('removes a weapon from the pool for the rest of the run', () => {
    const loadout = { weapons: {}, passives: {} }
    const target = WEAPONS[0].id
    const banished = new Set([target])
    // Many draws, because a single draw missing it proves nothing.
    for (let i = 0; i < 60; i++) {
      const rolled = rollUpgrades(loadout, stats, new RNG(i), 3, null, banished)
      expect(rolled.some((c) => c.id === target)).toBe(false)
    }
  })

  it('removes a passive too', () => {
    const loadout = { weapons: {}, passives: {} }
    const target = PASSIVES[0].id
    const banished = new Set([target])
    for (let i = 0; i < 60; i++) {
      const rolled = rollUpgrades(loadout, stats, new RNG(i), 3, null, banished)
      expect(rolled.some((c) => c.id === target)).toBe(false)
    }
  })

  it('takes the evolution with the weapon it comes from', () => {
    // Banishing is offered on an evolution card, and the game strikes the base
    // weapon. That has to hide the evolution as well, or the strike does nothing.
    const base = WEAPONS.find((w) => w.evolvesTo && w.pairPassive)
    const loadout = {
      weapons: { [base.id]: base.levels.length },
      passives: { [base.pairPassive]: 1 },
    }
    const open = rollUpgrades(loadout, stats, new RNG(3), 3, null, null)
    expect(open.some((c) => c.kind === 'evolution' && c.replaces === base.id)).toBe(true)
    const banished = new Set([base.id])
    for (let i = 0; i < 40; i++) {
      const rolled = rollUpgrades(loadout, stats, new RNG(i), 3, null, banished)
      expect(rolled.some((c) => c.kind === 'evolution' && c.replaces === base.id)).toBe(false)
    }
  })

  it('still fills the modal when the pool is banished down to nothing', () => {
    const loadout = { weapons: {}, passives: {} }
    const banished = new Set([...WEAPONS.map((w) => w.id), ...PASSIVES.map((p) => p.id)])
    const rolled = rollUpgrades(loadout, stats, new RNG(1), 3, null, banished)
    expect(rolled).toHaveLength(3)
    expect(rolled.every((c) => c.kind === 'consumable')).toBe(true)
  })

  it('is a no-op when nothing is banished', () => {
    const loadout = { weapons: {}, passives: {} }
    const a = rollUpgrades(loadout, stats, new RNG(7), 3, null, null)
    const b = rollUpgrades(loadout, stats, new RNG(7), 3, null, new Set())
    expect(b.map((c) => c.id)).toEqual(a.map((c) => c.id))
  })
})
