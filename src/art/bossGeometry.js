import * as THREE from 'three'
import { buildColored, gradient, limb, revolve, roughen } from './shapeKit.js'

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

  // Crown of spikes over the shoulders — the read that this is the 妖王.
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

function darkHeavenLord() {
  const parts = []

  // A long robe that pools on the ground.
  const robe = revolve([
    [0.00, 4.05], [0.42, 3.95], [0.56, 3.35], [0.70, 2.55],
    [0.98, 1.55], [1.32, 0.62], [1.55, 0.12], [1.45, 0.00], [0.00, 0.00],
  ], 22)
  gradient(robe, LORD_MID, LORD_DARK, 'y')
  parts.push([robe, {}, undefined])

  // Torso, neck, head.
  parts.push([new THREE.SphereGeometry(0.46, 18, 14), { y: 4.35 }, LORD_DARK])
  // Featureless mask.
  parts.push([
    new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    { y: 4.38, z: 0.14, rx: 1.32 }, 0xf0e4ff,
  ])
  parts.push([new THREE.BoxGeometry(0.36, 0.05, 0.03), { y: 4.4, z: 0.46 }, LORD_GLOW])

  // Horned crown.
  for (const side of [-1, 1]) {
    parts.push([
      limb(
        [[side * 0.24, 4.7, -0.05], [side * 0.5, 5.2, -0.25], [side * 0.44, 5.6, -0.6]],
        [0.16, 0.1, 0.03], 10, 6,
      ),
      {}, LORD_GOLD,
    ])
  }

  // Shoulder mantle and waist sash.
  parts.push([new THREE.CylinderGeometry(1.05, 0.6, 0.28, 18), { y: 3.62 }, LORD_LIGHT])
  parts.push([new THREE.CylinderGeometry(1.02, 1.02, 0.16, 18), { y: 2.3 }, LORD_GOLD])

  // Wide sleeves.
  for (const side of [-1, 1]) {
    parts.push([
      limb(
        [[side * 0.68, 3.5, 0], [side * 1.05, 2.8, 0.12], [side * 0.95, 2.05, 0.02]],
        [0.3, 0.42, 0.28], 12, 8,
      ),
      {}, LORD_MID,
    ])
  }

  // A halo of runes behind the head.
  parts.push([new THREE.TorusGeometry(0.95, 0.045, 6, 28), { y: 4.5, z: -0.5, rx: 0.25 }, LORD_GOLD])
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    parts.push([
      new THREE.BoxGeometry(0.13, 0.13, 0.03),
      { x: Math.cos(a) * 0.95, y: 4.5 + Math.sin(a) * 0.95, z: -0.5, rz: a },
      LORD_GLOW,
    ])
  }

  return buildColored(parts)
}

const BUILDERS = {
  blueWolfKing: wolfKing,
  darkHeavenLord,
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
