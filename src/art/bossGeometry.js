import * as THREE from 'three'
import { buildColored, gradient, limb, revolve, roughen, shear } from './shapeKit.js'

/**
 * Dedicated boss geometry.
 *
 * A boss cannot be an ordinary enemy scaled up — the silhouette has to say
 * "this one is different" before the health bar does. There is only ever one
 * alive, so these can afford far more parts than the instanced horde.
 */

const cache = new Map()

const WOLF_DARK = 0x243b56
const WOLF_MID = 0x4d719b
const WOLF_LIGHT = 0x9dc0e0
const WOLF_STEEL = 0x7d94ad
const EMBER = 0xffc65e

const LORD_DARK = 0x2a1550
const LORD_MID = 0x5c2f96
const LORD_LIGHT = 0xa878e0
const LORD_GOLD = 0xe8c56a
const LORD_GLOW = 0xd98cff

const WARDEN_DARK = 0x10252b
const WARDEN_MID = 0x285c5b
const WARDEN_PLATE = 0x7d9f9a
const WARDEN_JADE = 0x4bd1b2
const WARDEN_GOLD = 0xcda76a
const WARDEN_GLOW = 0xb4fff0

function wolfKing() {
  const parts = []

  const body = limb(
    [[0, 1.05, -1.3], [0, 1.32, -0.45], [0, 1.36, 0.4], [0, 1.14, 1.15]],
    [0.95, 1.5, 1.32, 0.78], 22, 12,
  )
  body.scale(0.60, 0.55, 0.60)
  gradient(body, WOLF_MID, WOLF_DARK, 'y')
  parts.push([body, {}, undefined])

  const head = limb(
    [[0, 1.42, 1.1], [0, 1.38, 1.5], [0, 1.24, 1.92]],
    [0.72, 0.6, 0.3], 12, 10,
  )
  head.scale(0.62, 0.58, 0.62)
  gradient(head, WOLF_LIGHT, WOLF_MID, 'y')
  parts.push([head, {}, undefined])

  // Muzzle, jaw and eyes.
  parts.push([new THREE.ConeGeometry(0.2, 0.55, 8), { y: 1.2, z: 2.05, rx: Math.PI / 2 }, WOLF_DARK])
  parts.push([new THREE.SphereGeometry(0.1, 8, 6), { x: -0.2, y: 1.5, z: 1.78 }, EMBER])
  parts.push([new THREE.SphereGeometry(0.1, 8, 6), { x: 0.2, y: 1.5, z: 1.78 }, EMBER])

  // Ears, swept back.
  for (const side of [-1, 1]) {
    parts.push([new THREE.ConeGeometry(0.16, 0.5, 5), { x: side * 0.28, y: 1.88, z: 1.35, rx: -0.35, rz: side * 0.2 }, WOLF_DARK])
  }

  // Crown of spikes over the shoulders gives the boss a sovereign silhouette.
  for (let i = 0; i < 11; i++) {
    const a = -0.75 + i * 0.15
    const len = 0.55 + Math.cos(a) * 0.35
    parts.push([
      new THREE.ConeGeometry(0.1, len, 5),
      { x: Math.sin(a) * 0.62, y: 1.95 + Math.cos(a) * 0.12, z: 0.55, rx: -0.5, rz: a * 1.1 },
      i % 2 ? WOLF_STEEL : WOLF_DARK,
    ])
  }

  // Armour plates along the flanks.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      parts.push([
        roughen(new THREE.DodecahedronGeometry(0.26, 0), 0.05, 3 + i),
        { x: side * 0.62, y: 1.42 - i * 0.06, z: 0.25 - i * 0.5 },
        WOLF_STEEL,
      ])
    }
  }

  // Legs.
  for (const [lx, lz] of [[-0.42, 0.72], [0.42, 0.72], [-0.42, -0.72], [0.42, -0.72]]) {
    parts.push([
      limb(
        [[lx, 1.05, lz], [lx * 1.18, 0.55, lz - 0.05], [lx * 1.22, 0.05, lz]],
        [0.22, 0.16, 0.14], 10, 7,
      ),
      {}, WOLF_DARK,
    ])
    parts.push([new THREE.SphereGeometry(0.2, 8, 6), { x: lx * 1.22, y: 0.12, z: lz + 0.06 }, WOLF_STEEL])
  }

  // Three tails.
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.45
    parts.push([
      limb(
        [[0, 1.15, -1.3], [Math.sin(a) * 0.5, 1.55, -1.95], [Math.sin(a) * 0.85, 2.05, -2.45]],
        [0.19, 0.13, 0.04], 12, 7,
      ),
      {}, i === 1 ? WOLF_MID : WOLF_DARK,
    ])
  }

  return buildColored(parts)
}

/**
 * 암천마존 — the run's final boss.
 *
 * The first version was a lathed robe with a sphere on top: axially symmetric,
 * so from any angle it was a purple bowling pin with a halo behind it. A final
 * boss has to be the most imposing silhouette in the game, and a lathe cannot
 * be imposing — it has no front, no back, and nothing that reaches. Everything
 * added here exists to break the axis: a cape that sweeps back, a fan of blades,
 * a crown that is wider than his shoulders, and arms that come forward.
 */
function darkHeavenLord() {
  const parts = []

  // A long robe that pools on the ground, leaning forward off its own axis.
  const robe = revolve([
    [0.00, 4.05], [0.42, 3.95], [0.56, 3.35], [0.70, 2.55],
    [0.98, 1.55], [1.32, 0.62], [1.55, 0.12], [1.45, 0.00], [0.00, 0.00],
  ], 22)
  gradient(robe, LORD_MID, LORD_DARK, 'y')
  shear(robe, 0.09)
  parts.push([robe, {}, undefined])

  // Torso, neck, head.
  parts.push([new THREE.SphereGeometry(0.46, 18, 14), { y: 4.35, z: 0.36 }, LORD_DARK])
  // Featureless mask.
  parts.push([
    new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    { y: 4.38, z: 0.5, rx: 1.32 }, 0xf0e4ff,
  ])
  parts.push([new THREE.BoxGeometry(0.36, 0.05, 0.03), { y: 4.4, z: 0.82 }, LORD_GLOW])

  // Crown of horns, wider than his shoulders. Two horns read as a helmet; five
  // sweeping back read as a crown, and the width is most of the menace.
  for (let i = 0; i < 5; i++) {
    const t = i / 4
    const side = t < 0.5 ? -1 : 1
    const k = Math.abs(t - 0.5) * 2
    const spread = 0.22 + k * 0.62
    const rise = 1.15 - k * 0.34
    parts.push([
      limb(
        [[side * 0.2 * (i === 2 ? 0 : 1), 4.66, 0.28],
          [side * spread * 0.7, 4.66 + rise * 0.45, 0.02],
          [side * spread, 4.66 + rise * 0.82, -0.42],
          [side * spread * 0.86, 4.66 + rise, -0.92]],
        [0.17, 0.12, 0.07, 0.02], 14, 6,
      ),
      {}, i % 2 ? LORD_GOLD : LORD_LIGHT,
    ])
  }

  // Shoulder mantle and waist sash.
  parts.push([new THREE.CylinderGeometry(1.15, 0.62, 0.30, 18), { y: 3.62, z: 0.12 }, LORD_LIGHT])
  parts.push([new THREE.CylinderGeometry(1.02, 1.02, 0.16, 18), { y: 2.3 }, LORD_GOLD])

  // Cape, sweeping back and up off the shoulders. This is what stops him being
  // a solid of revolution from the side.
  for (const [dx, w, len, lift] of [[-0.66, 0.5, 2.5, 0.5], [0, 0.62, 3.1, 0.9], [0.66, 0.5, 2.5, 0.5]]) {
    parts.push([
      limb(
        [[dx, 3.55, -0.35], [dx * 1.5, 3.2 + lift, -1.2], [dx * 1.9, 2.3 + lift, -len * 0.72], [dx * 2.0, 1.1, -len]],
        [w, w * 0.92, w * 0.6, 0.06], 16, 6,
      ),
      { sy: 1, sz: 1, sx: 0.55 }, LORD_DARK,
    ])
  }

  // Wide sleeves, brought forward as though mid-cast.
  for (const side of [-1, 1]) {
    parts.push([
      limb(
        [[side * 0.72, 3.5, 0.14], [side * 1.12, 2.9, 0.72], [side * 0.98, 2.35, 1.22]],
        [0.3, 0.42, 0.26], 14, 8,
      ),
      {}, LORD_MID,
    ])
    // Clawed hand at the cuff.
    for (let f = -1; f <= 1; f++) {
      parts.push([
        new THREE.ConeGeometry(0.05, 0.34, 4),
        { x: side * (0.98 + f * 0.1), y: 2.28, z: 1.42, rx: 1.9 },
        LORD_GLOW,
      ])
    }
  }

  // A fan of blades standing behind him.
  for (let i = 0; i < 9; i++) {
    const a = -1.25 + (i / 8) * 2.5
    parts.push([
      new THREE.BoxGeometry(0.07, 1.5 + Math.cos(a) * 0.7, 0.035),
      {
        x: Math.sin(a) * 1.5,
        y: 3.5 + Math.cos(a) * 0.55,
        z: -0.85 - Math.cos(a) * 0.35,
        rz: a * 0.7,
      },
      i % 2 ? LORD_LIGHT : LORD_GOLD,
    ])
  }

  // A halo of runes behind the head.
  parts.push([new THREE.TorusGeometry(1.05, 0.05, 6, 28), { y: 4.6, z: -0.35, rx: 0.25 }, LORD_GOLD])
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    parts.push([
      new THREE.BoxGeometry(0.15, 0.15, 0.03),
      { x: Math.cos(a) * 1.05, y: 4.6 + Math.sin(a) * 1.05, z: -0.35, rz: a },
      LORD_GLOW,
    ])
  }

  return buildColored(parts)
}

const RIME_DEEP = 0x21384f
const RIME_MID = 0x4f7fa6
const RIME_ICE = 0xa8dcf0
const RIME_PALE = 0xdff2ff

/**
 * 설녀 빙하 — the mid boss of 한천비경.
 *
 * 요왕 창랑 is a quadruped that charges: mass low to the ground, coming at you.
 * This one has to read as the opposite from the first frame or the two fights
 * feel the same — so she is tall, still and vertical, a column of ice with a
 * trailing veil, and she keeps her distance and drops the sky on you.
 *
 * Built from the same shapeKit as the other two. The silhouette rule from the
 * 마존 comment applies here as well: a lathe alone has no front, so the veil,
 * the shard crown and the two floating hands are what break the axis.
 */
function riverMaiden() {
  const parts = []

  // A column that widens into a pooled hem, leaning very slightly back.
  const gown = revolve([
    [0.00, 3.45], [0.34, 3.32], [0.46, 2.80], [0.54, 2.05],
    [0.78, 1.25], [1.15, 0.48], [1.42, 0.08], [1.30, 0.00], [0.00, 0.00],
  ], 26)
  gradient(gown, RIME_MID, RIME_DEEP, 'y')
  shear(gown, 0, -0.05, 0.9)
  parts.push([gown, {}, undefined])

  // Head and the frozen veil behind it.
  parts.push([new THREE.SphereGeometry(0.42, 14, 12), { y: 3.62 }, RIME_PALE])
  const veil = revolve([
    [0.00, 0.00], [0.62, -0.35], [0.95, -1.15], [1.05, -2.10], [0.86, -2.95], [0.00, -3.05],
  ], 20)
  gradient(veil, RIME_ICE, RIME_DEEP, 'y')
  shear(veil, 0, 0, -0.34)
  parts.push([veil, { y: 3.75, z: -0.32 }, undefined])

  // A crown of shards, tallest at the centre.
  for (let i = 0; i < 9; i++) {
    const a = -1.0 + i * 0.25
    const len = 0.55 + Math.cos(a) * 0.75
    parts.push([
      new THREE.ConeGeometry(0.09, len, 4),
      { x: Math.sin(a) * 0.44, y: 3.95 + len * 0.4, z: Math.cos(a) * 0.2 - 0.1, rz: a * 0.55 },
      i % 2 ? RIME_PALE : RIME_ICE,
    ])
  }

  // Two hands held out in front, unattached — she is not walking, she is
  // presiding, and the gap where arms should be is the point.
  for (const side of [-1, 1]) {
    parts.push([
      limb(
        [[side * 0.72, 2.45, 0.55], [side * 0.95, 2.15, 0.95], [side * 1.02, 1.92, 1.18]],
        [0.17, 0.13, 0.09], 10, 7,
      ),
      {}, RIME_PALE,
    ])
  }

  // Ice slabs orbiting the hem, so the base is not a smooth cone.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    parts.push([
      roughen(new THREE.OctahedronGeometry(0.30, 0), 0.07, 11 + i),
      { x: Math.sin(a) * 1.35, y: 0.32 + (i % 3) * 0.22, z: Math.cos(a) * 1.35, ry: a },
      i % 2 ? RIME_ICE : RIME_MID,
    ])
  }

  return buildColored(parts)
}

/**
 * 옥허진장 — the jade sanctuary's final guardian.
 *
 * The reference is an armoured warden, not a coloured robe with a halo. The
 * model therefore gets a real front/back break, layered shoulder and waist
 * plates, a mask, a chest core, a split mantle and a weapon silhouette. It is
 * still one merged boss geometry, so the detail is paid once rather than by the
 * horde's instanced path.
 */
function jadeVoidWarden() {
  const parts = []

  const robe = revolve([
    [0.00, 5.12], [0.42, 5.00], [0.62, 4.28], [0.76, 3.28],
    [0.98, 2.10], [1.42, 0.78], [1.72, 0.12], [1.58, 0.00], [0.00, 0.00],
  ], 20)
  gradient(robe, WARDEN_MID, WARDEN_DARK, 'y')
  shear(robe, 0.13, { from: 0.9 })
  parts.push([robe, { z: -0.12 }, undefined])

  // Split front panels and a raised waist guard keep the robe from reading as
  // one smooth cone when the boss turns toward the player.
  for (const side of [-1, 1]) {
    parts.push([
      new THREE.BoxGeometry(0.54, 2.15, 0.18),
      { x: side * 0.34, y: 1.35, z: 1.05, rz: side * 0.055 },
      side < 0 ? WARDEN_DARK : WARDEN_MID,
    ])
    parts.push([
      new THREE.BoxGeometry(0.72, 0.26, 0.24),
      { x: side * 0.42, y: 2.42, z: 0.96, rz: side * 0.14 },
      WARDEN_PLATE,
    ])
  }

  // Torso, collar and engraved chest plate.
  parts.push([
    new THREE.SphereGeometry(0.82, 20, 14),
    { y: 3.55, z: 0.08, sx: 1.16, sy: 1.04, sz: 0.78 },
    WARDEN_DARK,
  ])
  parts.push([
    new THREE.CylinderGeometry(0.76, 0.66, 0.28, 14),
    { y: 3.48, z: 0.72, rx: Math.PI / 2 },
    WARDEN_PLATE,
  ])
  parts.push([
    new THREE.TorusGeometry(0.42, 0.055, 8, 28),
    { y: 3.48, z: 0.91, rx: Math.PI / 2 },
    WARDEN_GOLD,
  ])
  parts.push([
    new THREE.OctahedronGeometry(0.30, 2),
    { y: 3.48, z: 1.02, rz: Math.PI / 4 },
    WARDEN_GLOW,
  ])

  // A layered shoulder line gives the armour an asymmetric, readable mass.
  for (const side of [-1, 1]) {
    parts.push([
      new THREE.SphereGeometry(0.52, 14, 10),
      { x: side * 0.98, y: 3.77, z: 0.02, sx: 1.34, sy: 0.56, sz: 0.92 },
      WARDEN_PLATE,
    ])
    parts.push([
      new THREE.BoxGeometry(0.62, 0.30, 0.82),
      { x: side * 1.03, y: 3.95, z: 0.08, rx: 0.10, ry: side * 0.10, rz: side * -0.22 },
      WARDEN_MID,
    ])
    parts.push([
      limb([
        [side * 1.05, 3.42, 0.06],
        [side * 1.38, 2.78, 0.42],
        [side * 1.16, 1.88, 0.82],
      ], [0.28, 0.24, 0.16], 10, 6),
      {}, WARDEN_DARK,
    ])
    for (let i = 0; i < 3; i++) {
      parts.push([
        new THREE.BoxGeometry(0.34, 0.20, 0.62),
        { x: side * (1.25 - i * 0.06), y: 2.74 - i * 0.22, z: 0.45 + i * 0.16, ry: side * 0.18 },
        i === 1 ? WARDEN_PLATE : WARDEN_MID,
      ])
    }
  }

  // Mask, horn crown and jade eye pair.
  parts.push([
    new THREE.SphereGeometry(0.56, 20, 14),
    { y: 4.72, z: 0.12, sx: 1.02, sy: 1.08, sz: 0.92 },
    WARDEN_DARK,
  ])
  parts.push([
    new THREE.SphereGeometry(0.40, 16, 10),
    { y: 4.63, z: 0.56, sx: 1.02, sy: 0.76, sz: 0.34 },
    WARDEN_PLATE,
  ])
  for (const side of [-1, 1]) {
    parts.push([
      new THREE.SphereGeometry(0.075, 12, 8),
      { x: side * 0.17, y: 4.72, z: 0.86 },
      WARDEN_GLOW,
    ])
    parts.push([
      limb([
        [side * 0.22, 5.08, 0.02],
        [side * 0.48, 5.42, -0.02],
        [side * 0.72, 5.72, -0.28],
        [side * 0.62, 5.70, -0.58],
      ], [0.14, 0.12, 0.08, 0.025], 12, 6),
      {}, WARDEN_GOLD,
    ])
  }
  for (let i = -2; i <= 2; i++) {
    parts.push([
      new THREE.ConeGeometry(0.11, 0.58 + Math.abs(i) * 0.06, 8),
      { x: i * 0.25, y: 5.08 + Math.abs(i) * 0.08, z: -0.18, rx: -0.50 },
      i === 0 ? WARDEN_JADE : WARDEN_PLATE,
    ])
  }

  // The split mantle and the polearm are the side-view anchors from the
  // reference image; they make the silhouette survive a camera orbit.
  for (const [side, lift] of [[-1, 0.3], [0, 0.72], [1, 0.42]]) {
    parts.push([
      limb([
        [side * 0.56, 3.68, -0.34],
        [side * 0.92, 3.08 + lift, -1.16],
        [side * 1.18, 2.18 + lift, -2.12],
        [side * 1.34, 0.88, -2.72],
      ], [0.40, 0.34, 0.22, 0.035], 12, 6),
      {}, side === 0 ? WARDEN_MID : WARDEN_DARK,
    ])
  }
  parts.push([
    limb([
      [-1.65, 0.18, 0.48], [-1.82, 1.42, 0.46], [-1.66, 2.82, 0.36], [-1.50, 3.86, 0.14],
    ], [0.10, 0.09, 0.07, 0.035], 12, 6),
    {}, WARDEN_DARK,
  ])
  parts.push([
    new THREE.TorusGeometry(0.72, 0.11, 8, 18, Math.PI * 0.82),
    { x: -1.66, y: 0.04, z: 0.68, rz: -0.36 },
    WARDEN_PLATE,
  ])
  parts.push([
    new THREE.ConeGeometry(0.14, 0.42, 7),
    { x: -1.48, y: 3.99, z: 0.12, rz: -0.35 },
    WARDEN_GOLD,
  ])

  // Large jade halo: the animated seal plates are added by BossManager so the
  // static geometry stays cacheable, but the ring is part of the silhouette.
  parts.push([
    new THREE.TorusGeometry(1.38, 0.055, 8, 32),
    { y: 4.52, z: -0.62, rx: 0.14 },
    WARDEN_JADE,
  ])
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.72 + i * (Math.PI * 1.44 / 4)
    parts.push([
      new THREE.BoxGeometry(0.25, 0.48, 0.06),
      { x: Math.cos(a) * 1.38, y: 4.52 + Math.sin(a) * 1.38, z: -0.62, rz: a + Math.PI / 2 },
      WARDEN_JADE,
    ])
  }

  const geometry = buildColored(parts)
  // Keep the reference's imposing proportions inside the shared boss-quality
  // gate; the boss definition supplies the final gameplay scale.
  geometry.scale(0.94, 0.94, 0.94)
  return geometry
}

const BUILDERS = {
  blueWolfKing: wolfKing,
  darkHeavenLord,
  riverMaiden,
  jadeVoidWarden,
}

export function buildBossGeometry(bossId) {
  let geo = cache.get(bossId)
  if (geo === undefined) {
    const build = BUILDERS[bossId]
    if (build === undefined) throw new Error(`[art] no geometry builder for boss "${bossId}"`)
    geo = build()
    cache.set(bossId, geo)
  }
  return geo
}
