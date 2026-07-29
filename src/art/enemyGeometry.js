import * as THREE from 'three'
import { buildColored, gradient, limb, revolve, roughen } from './shapeKit.js'

/**
 * One merged geometry per enemy type, built once and cached.
 *
 * Colour is baked into vertex colours rather than coming from the material, so a
 * single instanced draw call renders a creature with a dark back, a pale belly
 * and lit eyes. Shapes follow curves and lathe profiles instead of being boxes
 * bolted together — at a hundred on screen the silhouette is the only thing the
 * player can read, so it has to be a silhouette worth reading.
 */

const cache = new Map()

const BUILDERS = {
  // 마기 잔영 — a hooded wraith trailing off into smoke.
  wisp() {
    const shroud = revolve([
      [0.00, 0.95], [0.26, 0.86], [0.38, 0.68], [0.42, 0.44],
      [0.36, 0.24], [0.24, 0.10], [0.10, 0.00], [0.00, -0.06],
    ], 14)
    gradient(shroud, 0x3d2a72, 0x9070d8, 'y')
    roughen(shroud, 0.035, 7)

    const parts = [
      [shroud, {}, undefined],
      // Hollow of the hood.
      [new THREE.SphereGeometry(0.2, 12, 8), { y: 0.66, z: 0.1 }, 0x3a2a5c],
      // Two ember eyes — the only bright thing on it.
      [new THREE.SphereGeometry(0.052, 6, 5), { x: -0.085, y: 0.68, z: 0.24 }, 0xff9de0],
      [new THREE.SphereGeometry(0.052, 6, 5), { x: 0.085, y: 0.68, z: 0.24 }, 0xff9de0],
    ]
    // Ragged streamers trailing behind.
    for (let i = 0; i < 3; i++) {
      const a = -0.5 + i * 0.5
      parts.push([
        limb(
          [[a * 0.22, 0.34, -0.16], [a * 0.34, 0.16, -0.42], [a * 0.3, 0.02, -0.72]],
          [0.11, 0.06, 0.005], 8, 5,
        ),
        {}, 0x7b5fc0,
      ])
    }
    return buildColored(parts)
  },

  // 요랑 — a lean quadruped built to read as "charging at you".
  wolf() {
    const body = limb(
      [[0, 0.52, -0.46], [0, 0.58, -0.14], [0, 0.57, 0.22], [0, 0.52, 0.5]],
      [0.9, 1.25, 1.15, 0.72], 16, 9,
    )
    body.scale(0.30, 0.26, 0.30)
    gradient(body, 0x9fb6cf, 0x4d6584, 'y')

    const head = limb(
      [[0, 0.60, 0.48], [0, 0.58, 0.68], [0, 0.52, 0.86]],
      [0.62, 0.5, 0.24], 8, 8,
    )
    head.scale(0.33, 0.30, 0.33)
    gradient(head, 0xaec2d8, 0x57708f, 'y')

    const parts = [
      [body, {}, undefined],
      [head, {}, undefined],
      // Snout.
      [new THREE.ConeGeometry(0.085, 0.24, 6), { y: 0.5, z: 0.92, rx: Math.PI / 2 }, 0x4a5f78],
      // Eyes.
      [new THREE.SphereGeometry(0.042, 6, 5), { x: -0.085, y: 0.63, z: 0.78 }, 0xffd76a],
      [new THREE.SphereGeometry(0.042, 6, 5), { x: 0.085, y: 0.63, z: 0.78 }, 0xffd76a],
      // Ears.
      [new THREE.ConeGeometry(0.062, 0.17, 4), { x: -0.11, y: 0.78, z: 0.6, rx: -0.2 }, 0x56708c],
      [new THREE.ConeGeometry(0.062, 0.17, 4), { x: 0.11, y: 0.78, z: 0.6, rx: -0.2 }, 0x56708c],
    ]

    // Legs, angled slightly outward.
    for (const [lx, lz] of [[-0.14, 0.3], [0.14, 0.3], [-0.14, -0.26], [0.14, -0.26]]) {
      parts.push([
        limb([[lx, 0.44, lz], [lx * 1.15, 0.24, lz - 0.02], [lx * 1.2, 0.02, lz]], [0.075, 0.055, 0.05], 6, 5),
        {}, 0x5a7391,
      ])
    }

    // Shoulder mane.
    for (let i = 0; i < 7; i++) {
      const a = -0.45 + i * 0.15
      parts.push([
        new THREE.ConeGeometry(0.055, 0.24, 4),
        { x: Math.sin(a) * 0.2, y: 0.76 + Math.cos(a) * 0.04, z: 0.18, rx: -0.55, rz: a },
        0x4a6180,
      ])
    }

    // Tail.
    parts.push([
      limb([[0, 0.5, -0.5], [0, 0.62, -0.72], [0.04, 0.78, -0.88]], [0.07, 0.05, 0.02], 8, 5),
      {}, 0x56708c,
    ])
    return buildColored(parts)
  },

  // 석귀 — a hunched mass of stone with a sunken head and heavy arms.
  stoneGhoul() {
    const torso = revolve([
      [0.00, 1.28], [0.42, 1.20], [0.66, 0.94], [0.74, 0.58],
      [0.66, 0.26], [0.48, 0.06], [0.00, 0.00],
    ], 12)
    gradient(torso, 0x6e6558, 0xa89c88, 'y')
    roughen(torso, 0.085, 3)

    const parts = [
      [torso, {}, undefined],
      // Head, half-buried in the shoulders.
      [roughen(new THREE.DodecahedronGeometry(0.32, 0), 0.06, 11), { y: 1.26, z: 0.08 }, 0xb0a493],
      // Glowing seams where the stone has cracked open.
      [new THREE.SphereGeometry(0.055, 6, 5), { x: -0.13, y: 1.3, z: 0.26 }, 0xff8a5a],
      [new THREE.SphereGeometry(0.055, 6, 5), { x: 0.13, y: 1.3, z: 0.26 }, 0xff8a5a],
      [new THREE.BoxGeometry(0.5, 0.05, 0.04), { y: 0.72, z: 0.62, rz: 0.3 }, 0xd8663a],
      [new THREE.BoxGeometry(0.34, 0.05, 0.04), { y: 0.5, z: 0.6, rz: -0.4 }, 0xb8552f],
    ]

    // Heavy arms hanging past the knees.
    for (const side of [-1, 1]) {
      parts.push([
        limb(
          [[side * 0.72, 1.02, 0], [side * 0.88, 0.62, 0.06], [side * 0.8, 0.22, 0.02]],
          [0.9, 1.05, 1.25], 8, 6,
        ),
        { sx: 0.24, sy: 0.24, sz: 0.24 }, undefined,
      ])
      parts[parts.length - 1][2] = 0xa4998a
      // Fist.
      parts.push([roughen(new THREE.DodecahedronGeometry(0.26, 0), 0.05, 5 + side), { x: side * 0.8, y: 0.16 }, 0x8d8375])
      // Stubby leg.
      parts.push([new THREE.CylinderGeometry(0.2, 0.24, 0.3, 6), { x: side * 0.3, y: 0.14 }, 0x7d7466])
    }
    return buildColored(parts)
  },

  // 부적귀 — an empty robe held up by a talisman where the face should be.
  talismanGhost() {
    const robe = revolve([
      [0.00, 1.30], [0.20, 1.24], [0.28, 1.02], [0.34, 0.72],
      [0.46, 0.36], [0.56, 0.10], [0.50, 0.02], [0.00, 0.00],
    ], 14)
    gradient(robe, 0xc4b073, 0xefe2bc, 'y')

    const parts = [
      [robe, {}, undefined],
      // The talisman itself, and the void behind it.
      [new THREE.SphereGeometry(0.19, 10, 8), { y: 1.2 }, 0x4a412c],
      [new THREE.BoxGeometry(0.26, 0.4, 0.03), { y: 1.2, z: 0.17 }, 0xf6e9b0],
      [new THREE.BoxGeometry(0.05, 0.28, 0.02), { y: 1.2, z: 0.19 }, 0xb4342a],
      [new THREE.BoxGeometry(0.14, 0.04, 0.02), { y: 1.3, z: 0.19 }, 0xb4342a],
      [new THREE.BoxGeometry(0.14, 0.04, 0.02), { y: 1.1, z: 0.19 }, 0xb4342a],
      // A sash at the waist.
      [new THREE.CylinderGeometry(0.36, 0.36, 0.07, 14), { y: 0.62 }, 0x9a3f34],
    ]

    // Wide hanging sleeves.
    for (const side of [-1, 1]) {
      parts.push([
        limb(
          [[side * 0.3, 1.02, 0], [side * 0.46, 0.78, 0.04], [side * 0.42, 0.5, 0]],
          [0.75, 1.0, 0.7], 8, 6,
        ),
        { sx: 0.3, sy: 0.3, sz: 0.3 }, 0xe6dcb4,
      ])
    }
    return buildColored(parts)
  },

  // 혈갈 — flattened carapace, splayed legs, tail arched over the back.
  bloodScorpion() {
    const shell = revolve([
      [0.00, 0.30], [0.26, 0.28], [0.42, 0.20], [0.46, 0.10], [0.36, 0.02], [0.00, 0.00],
    ], 14)
    shell.scale(1, 1, 1.3)
    gradient(shell, 0x8a2340, 0xc44a63, 'y')

    const parts = [[shell, {}, undefined]]

    // Segmented tail curling up and forward over the body.
    const tail = limb(
      [[0, 0.24, -0.4], [0, 0.52, -0.62], [0, 0.86, -0.5], [0, 0.96, -0.14], [0, 0.86, 0.06]],
      [0.9, 0.78, 0.62, 0.46, 0.3], 20, 7,
    )
    tail.scale(0.19, 0.19, 0.19)
    gradient(tail, 0x932c44, 0xc0455e, 'y')
    parts.push([tail, {}, undefined])
    parts.push([new THREE.ConeGeometry(0.07, 0.24, 6), { y: 0.8, z: 0.16, rx: 1.9 }, 0x6d2333])

    // Legs.
    for (let i = 0; i < 3; i++) {
      const z = -0.12 + i * 0.19
      for (const side of [-1, 1]) {
        parts.push([
          limb(
            [[side * 0.3, 0.16, z], [side * 0.52, 0.14, z + side * 0.04], [side * 0.6, 0.0, z + side * 0.06]],
            [0.5, 0.4, 0.28], 6, 5,
          ),
          { sx: 0.18, sy: 0.18, sz: 0.18 }, 0xb0435a,
        ])
      }
    }

    // Pincers.
    for (const side of [-1, 1]) {
      parts.push([
        limb([[side * 0.26, 0.2, 0.38], [side * 0.4, 0.18, 0.6], [side * 0.34, 0.16, 0.74]], [0.6, 0.75, 0.5], 8, 6),
        { sx: 0.2, sy: 0.2, sz: 0.2 }, 0xc8536b,
      ])
      parts.push([new THREE.ConeGeometry(0.06, 0.2, 5), { x: side * 0.34, y: 0.17, z: 0.86, rx: Math.PI / 2 }, 0x7e2a3c])
    }
    return buildColored(parts)
  },

  // 마수사 — a corrupted cultivator: robe, masked face, a ring of blades.
  demonCultivator() {
    const robe = revolve([
      [0.00, 1.72], [0.22, 1.64], [0.30, 1.30], [0.40, 0.92],
      [0.58, 0.46], [0.72, 0.10], [0.64, 0.02], [0.00, 0.00],
    ], 16)
    gradient(robe, 0x4d2a80, 0x9a6ed4, 'y')

    const parts = [
      [robe, {}, undefined],
      [new THREE.SphereGeometry(0.24, 14, 10), { y: 1.76 }, 0x412a63],
      // Featureless mask.
      [new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), { y: 1.78, z: 0.08, rx: 1.35 }, 0xe8d9ff],
      [new THREE.BoxGeometry(0.19, 0.028, 0.02), { y: 1.79, z: 0.24 }, 0x5a2f8f],
      // Shoulder mantle and sash.
      [new THREE.CylinderGeometry(0.42, 0.3, 0.14, 14), { y: 1.44 }, 0x8f5fd0],
      [new THREE.CylinderGeometry(0.46, 0.46, 0.08, 14), { y: 0.86 }, 0xd8b45a],
    ]

    for (const side of [-1, 1]) {
      parts.push([
        limb(
          [[side * 0.32, 1.4, 0], [side * 0.5, 1.06, 0.06], [side * 0.44, 0.74, 0.02]],
          [0.7, 0.95, 0.62], 8, 6,
        ),
        { sx: 0.3, sy: 0.3, sz: 0.3 }, 0xa075de,
      ])
    }

    // Blades orbiting at his back.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      parts.push([
        new THREE.BoxGeometry(0.035, 0.44, 0.02),
        { x: Math.cos(a) * 0.6, y: 2.08 + Math.sin(a * 2) * 0.07, z: Math.sin(a) * 0.6 - 0.2, rz: a * 0.5 },
        0xd9c2ff,
      ])
    }
    return buildColored(parts)
  },
}

export function buildEnemyGeometry(enemyId) {
  let geo = cache.get(enemyId)
  if (geo === undefined) {
    const build = BUILDERS[enemyId]
    if (build === undefined) throw new Error(`[art] no geometry builder for enemy "${enemyId}"`)
    geo = build()
    cache.set(enemyId, geo)
  }
  return geo
}
