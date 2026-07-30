import { describe, it, expect } from 'vitest'
import { stepPickup, COLLECT_RADIUS, PICKUP_KINDS } from '../src/entities/PickupManager.js'
import { BASE_STATS } from '../src/data/characters.js'
import { xpFor } from '../src/data/realms.js'
import { ENEMIES } from '../src/data/enemies.js'

/**
 * The 영기 economy, measured rather than assumed.
 *
 * A scripted two-minute run collected 14% of the experience it earned: 345 orbs
 * dropped, 49 picked up, 145 still lying on the ground at death. Every one of
 * those was a kill made while retreating, which is the whole shape of the genre.
 * The XP curve is authored for the full amount, so progression ran at a seventh
 * of its design and the run ended at level 3 instead of the intended 10+.
 *
 * These drive `stepPickup` — the same function the render loop calls, not a
 * restatement of it — so the numbers below cannot drift away from the game.
 */

/**
 * Integrate one drop under the real pull rule. Returns the collection time, or
 * null if the player was never reached inside `limit` seconds.
 *
 * @param {(t: number) => {x: number, z: number}} path Where the player is at t.
 */
function chase(kind, x, z, path, { magnet = BASE_STATS.magnet, limit = 12, dt = 1 / 60, still = false } = {}) {
  const o = { x, z, vx: 0, vz: 0 }
  const isQi = kind === 'qi'
  for (let t = 0; t < limit; t += dt) {
    const p = path(t)
    // `still` reproduces the shipped behaviour this fix replaced: an orb sits
    // where it fell and only ever moves once the player walks inside the magnet.
    if (still && Math.hypot(p.x - o.x, p.z - o.z) >= magnet) continue
    if (stepPickup(o, p.x, p.z, magnet, isQi, dt) < COLLECT_RADIUS) return t
  }
  return null
}

const standing = () => ({ x: 0, z: 0 })

describe('영기 collection', () => {
  it('reaches an orb dropped outside the magnet radius', () => {
    // Twice the magnet radius. The old build left this one on the ground for
    // the rest of the run, and 145 of them were there at death.
    const t = chase('qi', BASE_STATS.magnet * 2, 0, standing)
    expect(t, 'an orb outside the magnet is never recovered').not.toBeNull()
  })

  it('recovers a kill made across the width of the screen', () => {
    expect(chase('qi', 18, 0, standing, { limit: 20 }), '18 units away is unreachable').not.toBeNull()
  })

  it('does not let an orb outrun the player she is sprinting away from', () => {
    // The drift must stay well under her own speed, or 영기 would chase her
    // across the map and both the magnet stat and 백로's trait would be dead
    // weight. It should close the gap only while she is not fleeing flat out.
    const flee = (t) => ({ x: -BASE_STATS.moveSpeed * t, z: 0 })
    expect(chase('qi', 12, 0, flee, { limit: 6 }), 'the orb caught a sprinting player').toBeNull()
  })

  it('still rewards a bigger magnet with a faster pickup', () => {
    const near = chase('qi', 7, 0, standing, { magnet: BASE_STATS.magnet })
    const wide = chase('qi', 7, 0, standing, { magnet: BASE_STATS.magnet * 2 })
    expect(wide).toBeLessThan(near)
  })

  it('homes every non-qi drop from any distance, as it always did', () => {
    for (const kind of PICKUP_KINDS.filter((k) => k !== 'qi')) {
      expect(chase(kind, 20, 0, standing), `"${kind}" was left on the field`).not.toBeNull()
    }
  })
})

/**
 * Ways a player actually moves, all held to her real 5.2 u/s top speed. An
 * earlier version of this file drove her at 9.7 and concluded the game was
 * broken; the paths are capped deliberately.
 */
const R = 9
const W = BASE_STATS.moveSpeed / R
const PATHS = {
  weave: (t) => ({ x: Math.cos(t * 0.5) * 7, z: Math.sin(t * 0.83) * 6 }),
  'figure-eight': (t) => ({ x: Math.cos(t * W) * R, z: (Math.sin(t * W * 2) * R) / 2 }),
}

/**
 * A 300-kill run — roughly three minutes at the wave density stage one opens
 * with. Returns the fraction of orbs collected and the 영기 that reached her,
 * with each kill worth what the enemy that died is actually worth.
 */
function runRate(path, opts = {}) {
  let got = 0
  let xp = 0
  for (let n = 0; n < 300; n++) {
    const born = n * 0.6
    const a = (n * 2.39996) % (Math.PI * 2)
    const r = 4 + (n % 11)
    const at = path(born)
    const from = (dt) => path(born + dt)
    if (chase('qi', at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, from, { limit: 40, ...opts }) !== null) {
      got++
      xp += FODDER[n % FODDER.length].xp
    }
  }
  return { rate: got / 300, xp }
}

/**
 * What the early game actually spawns, straight from the enemy table rather
 * than a number chosen here — an earlier version of this test scored every kill
 * as one 영기 and made the curve look half as generous as it is.
 */
const FODDER = ENEMIES.filter((e) => !e.elite && e.xp <= 5)

describe('영기 economy against the level curve', () => {
  /**
   * The failure was only ever visible as a ratio between two subsystems: the
   * drop rate is fine, the curve is fine, and the run still starves. These
   * assert the join — that a run's worth of 영기 actually reaches the levels the
   * waves are built to hand out.
   */
  it('collects nearly everything a kiting player earns', () => {
    for (const [name, path] of Object.entries(PATHS)) {
      const { rate } = runRate(path)
      expect(rate, `${name}: only ${Math.round(rate * 100)}% of 영기 collected`).toBeGreaterThan(0.85)
    }
  })

  it('funds the intended level from a run\'s worth of drops', () => {
    let level = 1
    let bank = runRate(PATHS.weave).xp
    while (bank >= xpFor(level)) { bank -= xpFor(level); level++ }
    // 축기 is level 5 and 결단 is level 10; a three-minute run should be well
    // into 축기 and closing on 결단. The shipped build ended one whole realm
    // lower, at level 3, having left 145 orbs on the ground.
    expect(level, 'a full run of 영기 does not reach a meaningful level').toBeGreaterThanOrEqual(9)
  })

  it('beats leaving the orbs where they fell', () => {
    // The comparison the fix exists for: orbs lying where they fell, at the 3.0
    // magnet radius the game shipped with.
    for (const [name, path] of Object.entries(PATHS)) {
      const inert = runRate(path, { magnet: 3.0, still: true }).rate
      const live = runRate(path).rate
      expect(live, `${name}: the drift is no better than inert orbs`).toBeGreaterThan(inert + 0.3)
    }
  })
})
