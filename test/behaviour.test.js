import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { EnemyManager } from '../src/entities/EnemyManager.js'
import { ENEMIES, getEnemy } from '../src/data/enemies.js'
import { STAGES } from '../src/data/stages.js'
import { RNG } from '../src/core/rng.js'

/**
 * EnemyManager builds InstancedMeshes but never touches a WebGL context, so the
 * whole crowd simulation runs in node. These drive it directly rather than
 * asserting on the data table: the question is what the creatures *do*.
 */
function harness(seed = 7) {
  const scene = new THREE.Scene()
  const mgr = new EnemyManager(scene, new RNG(seed))
  // Spawning is driven by the wave table; silence it so tests control the set.
  mgr._spawnWave = () => {}
  const player = {
    x: 0, z: 0, prevX: 0, prevZ: 0,
    takeDamage: () => false,
  }
  const camera = { viewRadius: 60 }
  return { mgr, player, camera }
}

function step(mgr, player, camera, seconds, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) mgr.update(dt, 60, player, camera)
}

describe('behaviour coverage', () => {
  it('uses more than a couple of distinct behaviours across the bestiary', () => {
    const kinds = new Set(ENEMIES.map((e) => e.behavior))
    expect(kinds.size).toBeGreaterThanOrEqual(7)
  })

  it('gives every creature a behaviour the manager actually implements', () => {
    const known = new Set([
      'chase', 'dasher', 'ranged', 'splitter', 'flanker', 'charger', 'skirmisher',
      'drifter', 'flicker', 'lumberer',
    ])
    for (const e of ENEMIES) {
      expect(known.has(e.behavior), `"${e.id}" has unknown behaviour "${e.behavior}"`).toBe(true)
    }
  })

  it('leaves no more than a couple of creatures on the plain chase', () => {
    // Plain chase is the fallback, and every creature sharing it is every
    // creature moving identically — which is what the whole bestiary did.
    const plain = ENEMIES.filter((e) => e.behavior === 'chase')
    expect(plain.length, `${plain.map((e) => e.id).join(', ')} all just walk at her`).toBeLessThanOrEqual(2)
  })

  it('gives every stage a mix rather than one behaviour repeated', () => {
    for (const s of STAGES) {
      const kinds = new Set((s.roster ?? []).map((id) => getEnemy(id).behavior))
      expect(kinds.size, `${s.id} fields only ${[...kinds].join(', ')}`).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('flankers', () => {
  it('curve around the player instead of walking straight in', () => {
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('frostWolf', 0, -20, 60)
    const startX = mgr.px[i]
    step(mgr, player, camera, 1.2)
    // A beeline from (0,-20) keeps x at 0. Curving in means it left that line.
    expect(Math.abs(mgr.px[i] - startX)).toBeGreaterThan(1)
  })

  it('still closes the distance while it circles', () => {
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('frostWolf', 0, -20, 60)
    const before = Math.hypot(mgr.px[i], mgr.pz[i])
    step(mgr, player, camera, 2.5)
    expect(Math.hypot(mgr.px[i], mgr.pz[i])).toBeLessThan(before - 3)
  })

  it('sends a pack around both sides rather than into one queue', () => {
    const { mgr, player, camera } = harness(11)
    for (let n = 0; n < 12; n++) mgr.spawn('frostWolf', -1 + n * 0.2, -18, 60)
    step(mgr, player, camera, 1.6)
    let left = 0
    let right = 0
    for (let i = 0; i < mgr.pool.count; i++) (mgr.px[i] < 0 ? left++ : right++)
    expect(left).toBeGreaterThan(0)
    expect(right).toBeGreaterThan(0)
  })

  it('unwinds the arc up close, so it commits instead of orbiting forever', () => {
    const def = getEnemy('frostWolf')
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('frostWolf', 0, -(def.flankClose ?? 4) * 0.6, 60)
    const before = Math.hypot(mgr.px[i], mgr.pz[i])
    step(mgr, player, camera, 0.4)
    expect(Math.hypot(mgr.px[i], mgr.pz[i])).toBeLessThan(before)
  })
})

describe('chargers', () => {
  it('announce the charge before it happens', () => {
    const { mgr, player, camera } = harness()
    const tells = []
    mgr.onTelegraph = (x, z, dx, dz, seconds) => tells.push({ x, z, dx, dz, seconds })
    mgr.spawn('jadeSerpent', 0, -9, 60)
    step(mgr, player, camera, 4)
    expect(tells.length).toBeGreaterThan(0)
    expect(tells[0].seconds).toBeGreaterThan(0.2)
  })

  it('hold still during the wind-up, which is what makes it dodgeable', () => {
    const def = getEnemy('jadeSerpent')
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('jadeSerpent', 0, -9, 60)
    let frozenAt = null
    for (let t = 0; t < 4; t += 1 / 60) {
      const before = Math.hypot(mgr.px[i] - mgr.prevX[i], mgr.pz[i] - mgr.prevZ[i])
      mgr.update(1 / 60, 60, player, camera)
      const moved = Math.hypot(mgr.px[i] - mgr.prevX[i], mgr.pz[i] - mgr.prevZ[i])
      if (mgr.stateT[i] > (def.chargeInterval ?? 3.2) && mgr.dashT[i] <= 0) {
        frozenAt = moved
        break
      }
      void before
    }
    expect(frozenAt).not.toBeNull()
    expect(frozenAt).toBeLessThan(0.01)
  })

  it('commit to a locked line, so sidestepping actually works', () => {
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('jadeSerpent', 0, -9, 60)
    // Run until it launches.
    for (let t = 0; t < 6 && mgr.dashT[i] <= 0; t += 1 / 60) mgr.update(1 / 60, 60, player, camera)
    expect(mgr.dashT[i]).toBeGreaterThan(0)
    const lockX = mgr.chargeX[i]
    const lockZ = mgr.chargeZ[i]
    // Teleport the player aside mid-charge; the charge must not steer after them.
    player.x = 14
    mgr.update(1 / 60, 60, player, camera)
    expect(mgr.chargeX[i]).toBe(lockX)
    expect(mgr.chargeZ[i]).toBe(lockZ)
  })
})

describe('skirmishers', () => {
  it('back off after closing rather than staying in contact', () => {
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('ashRaven', 0, -6, 60)
    let closest = Infinity
    let reboundedTo = 0
    for (let t = 0; t < 4; t += 1 / 60) {
      mgr.update(1 / 60, 60, player, camera)
      const d = Math.hypot(mgr.px[i], mgr.pz[i])
      closest = Math.min(closest, d)
      if (mgr.dashT[i] > 0) reboundedTo = Math.max(reboundedTo, d)
    }
    expect(closest).toBeLessThan(3)
    expect(reboundedTo).toBeGreaterThan(closest + 0.5)
  })
})

describe('drifters', () => {
  it('weave in rather than tracking straight', () => {
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('wisp', 0, -14, 60)
    let maxOff = 0
    for (let t = 0; t < 3; t += 1 / 60) {
      mgr.update(1 / 60, 60, player, camera)
      maxOff = Math.max(maxOff, Math.abs(mgr.px[i]))
    }
    expect(maxOff).toBeGreaterThan(0.6)
  })

  it('still arrive', () => {
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('wisp', 0, -14, 60)
    step(mgr, player, camera, 4)
    expect(Math.hypot(mgr.px[i], mgr.pz[i])).toBeLessThan(11)
  })
})

describe('flickers', () => {
  it('travel in bursts instead of at one rate', () => {
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('emberSprite', 0, -16, 60)
    const steps = []
    for (let t = 0; t < 2; t += 1 / 60) {
      mgr.update(1 / 60, 60, player, camera)
      steps.push(Math.hypot(mgr.px[i] - mgr.prevX[i], mgr.pz[i] - mgr.prevZ[i]))
    }
    const fast = Math.max(...steps)
    const slow = Math.min(...steps.filter((s) => s > 0))
    expect(fast / slow).toBeGreaterThan(3)
  })
})

describe('lumberers', () => {
  it('speed up the longer they have been coming', () => {
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('glacierWarden', 0, -30, 60)
    step(mgr, player, camera, 0.5)
    const early = Math.hypot(mgr.px[i] - mgr.prevX[i], mgr.pz[i] - mgr.prevZ[i])
    step(mgr, player, camera, 12)
    const late = Math.hypot(mgr.px[i] - mgr.prevX[i], mgr.pz[i] - mgr.prevZ[i])
    expect(late).toBeGreaterThan(early * 1.4)
  })

  it('lose their momentum when the player breaks away', () => {
    const def = getEnemy('glacierWarden')
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('glacierWarden', 0, -14, 60)
    step(mgr, player, camera, 10)
    expect(mgr.stateT[i]).toBeGreaterThan(5)
    // Player runs well past its sight range.
    player.z = mgr.pz[i] - def.loseSight - 12
    mgr.update(1 / 60, 60, player, camera)
    expect(mgr.stateT[i]).toBeLessThan(1)
  })
})

describe('the crowd still works', () => {
  it('keeps plain chasers walking straight at the player', () => {
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('bloodScorpion', 0, -12, 60)
    step(mgr, player, camera, 1)
    expect(Math.abs(mgr.px[i])).toBeLessThan(0.5)
    expect(mgr.pz[i]).toBeGreaterThan(-12)
  })

  it('holds ranged attackers at their standoff distance', () => {
    const def = getEnemy('snowWraith')
    const { mgr, player, camera } = harness()
    const i = mgr.spawn('snowWraith', 0, -20, 60)
    step(mgr, player, camera, 8)
    const d = Math.hypot(mgr.px[i], mgr.pz[i])
    expect(d).toBeGreaterThan(def.keepDistance * 0.6)
    expect(d).toBeLessThan(def.keepDistance * 1.6)
  })
})
