import { describe, it, expect } from 'vitest'
import { WEAPON_MODULES, getWeaponModule } from '../src/combat/weapons/index.js'
import { WEAPONS, EVOLUTIONS } from '../src/data/weapons.js'

/**
 * Coverage over how the 법보 actually work, not how they look.
 *
 * The visual and audio passes gave every weapon its own trail, launch flash and
 * impact voice, and it would be easy to mistake that for the weapons being
 * different — a roster where fourteen modules all spawn one projectile with
 * different numbers would look varied and play identically. These assert the
 * mechanics underneath stay spread out.
 *
 * The shape of a module is the evidence available without a GL context:
 * `fire` alone is a cadence weapon, `update` means it runs continuously,
 * `attach`/`detach` mean it owns a persistent object in the world.
 */

function shapeOf(id) {
  const m = getWeaponModule(id)
  return {
    cadence: typeof m.fire === 'function',
    continuous: typeof m.update === 'function',
    persistent: typeof m.attach === 'function',
  }
}

const ALL = [...WEAPONS, ...EVOLUTIONS].map((w) => w.id)

describe('weapon mechanics', () => {
  it('does something for every shipped weapon', () => {
    for (const id of ALL) {
      const s = shapeOf(id)
      expect(s.cadence || s.continuous, `"${id}" neither fires nor runs`).toBe(true)
    }
  })

  it('is not one mechanic wearing fourteen skins', () => {
    // Distinct combinations of (cadence, continuous, persistent).
    const shapes = new Set(ALL.map((id) => JSON.stringify(shapeOf(id))))
    expect(shapes.size, 'every weapon has the same shape').toBeGreaterThanOrEqual(3)
  })

  it('ships weapons that run continuously, not only on a cadence', () => {
    const continuous = ALL.filter((id) => shapeOf(id).continuous)
    expect(continuous.length, 'nothing in the roster persists between shots').toBeGreaterThanOrEqual(3)
  })

  it('ships weapons that own something in the world', () => {
    const persistent = ALL.filter((id) => shapeOf(id).persistent)
    expect(persistent.length, 'no weapon maintains its own object').toBeGreaterThanOrEqual(2)
  })

  it('pairs attach with detach, so a persistent weapon cannot leak', () => {
    for (const id of ALL) {
      const m = getWeaponModule(id)
      expect(
        Boolean(m.attach) === Boolean(m.detach),
        `"${id}" attaches without detaching`,
      ).toBe(true)
    }
  })

  it('leaves no module in the registry without a data entry', () => {
    const known = new Set(ALL)
    for (const id of Object.keys(WEAPON_MODULES)) {
      expect(known.has(id), `module "${id}" is not in the weapon tables`).toBe(true)
    }
  })

  it('gives every evolution the shape of its parent or more', () => {
    // An evolution that dropped its parent's persistence would be a downgrade
    // dressed as an upgrade.
    for (const evo of EVOLUTIONS) {
      const parent = shapeOf(evo.evolutionOf)
      const child = shapeOf(evo.id)
      if (parent.persistent) {
        expect(child.persistent, `"${evo.id}" loses what "${evo.evolutionOf}" maintained`).toBe(true)
      }
      if (parent.continuous) {
        expect(child.continuous, `"${evo.id}" stops running continuously`).toBe(true)
      }
    }
  })
})

describe('weapon tags', () => {
  it('spreads the roster across damage elements rather than favouring one', () => {
    const counts = new Map()
    for (const w of [...WEAPONS, ...EVOLUTIONS]) {
      counts.set(w.tag, (counts.get(w.tag) ?? 0) + 1)
    }
    expect(counts.size, 'the roster uses too few elements').toBeGreaterThanOrEqual(4)
    // No single element may be more than half the roster: 공법 that boost one
    // tag would otherwise be strictly better than the rest.
    const total = WEAPONS.length + EVOLUTIONS.length
    for (const [tag, n] of counts) {
      expect(n / total, `"${tag}" is ${n} of ${total} weapons`).toBeLessThanOrEqual(0.5)
    }
  })
})
