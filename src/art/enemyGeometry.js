import * as THREE from 'three'
import { buildMerged } from './geometry.js'

/**
 * One merged low-poly geometry per enemy type, built once and cached.
 *
 * Each type gets a distinct silhouette — at gameplay distance, in a crowd of
 * hundreds, silhouette is the only thing the player can actually read.
 */

const cache = new Map()

const BUILDERS = {
  // 마기 잔영 — a torn shade with trailing wisps.
  wisp() {
    const body = new THREE.IcosahedronGeometry(0.42, 0)
    // Jitter the vertices so the shade looks frayed rather than crystalline.
    const pos = body.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) * (0.8 + Math.random() * 0.5),
        pos.getY(i) * (0.9 + Math.random() * 0.4),
        pos.getZ(i) * (0.8 + Math.random() * 0.5),
      )
    }
    body.computeVertexNormals()
    return buildMerged([
      [body, { y: 0.55 }],
      [new THREE.TetrahedronGeometry(0.20), { y: 0.30, z: -0.28 }],
      [new THREE.TetrahedronGeometry(0.14), { y: 0.16, z: -0.48 }],
    ])
  },

  // 요랑 — a low, long quadruped built for a charging silhouette.
  wolf() {
    return buildMerged([
      [new THREE.BoxGeometry(0.34, 0.32, 0.86), { y: 0.46 }],
      [new THREE.ConeGeometry(0.22, 0.44, 4), { y: 0.52, z: 0.56, rx: Math.PI / 2 }],
      [new THREE.BoxGeometry(0.10, 0.30, 0.10), { x: -0.13, y: 0.15, z: 0.28 }],
      [new THREE.BoxGeometry(0.10, 0.30, 0.10), { x: 0.13, y: 0.15, z: 0.28 }],
      [new THREE.BoxGeometry(0.10, 0.30, 0.10), { x: -0.13, y: 0.15, z: -0.28 }],
      [new THREE.BoxGeometry(0.10, 0.30, 0.10), { x: 0.13, y: 0.15, z: -0.28 }],
      [new THREE.ConeGeometry(0.09, 0.46, 4), { y: 0.62, z: -0.52, rx: -1.1 }],
      // Ears.
      [new THREE.ConeGeometry(0.08, 0.18, 4), { x: -0.12, y: 0.72, z: 0.34 }],
      [new THREE.ConeGeometry(0.08, 0.18, 4), { x: 0.12, y: 0.72, z: 0.34 }],
    ])
  },

  // 석귀 — a hunched mass of boulders, deliberately wide and heavy.
  stoneGhoul() {
    return buildMerged([
      [new THREE.DodecahedronGeometry(0.62, 0), { y: 0.70 }],
      [new THREE.DodecahedronGeometry(0.44, 0), { y: 1.18, z: 0.10 }],
      [new THREE.DodecahedronGeometry(0.30, 0), { y: 1.46, z: 0.16 }],
      [new THREE.BoxGeometry(0.24, 0.62, 0.24), { x: -0.62, y: 0.66, rz: 0.3 }],
      [new THREE.BoxGeometry(0.24, 0.62, 0.24), { x: 0.62, y: 0.66, rz: -0.3 }],
      [new THREE.BoxGeometry(0.26, 0.28, 0.26), { x: -0.30, y: 0.12 }],
      [new THREE.BoxGeometry(0.26, 0.28, 0.26), { x: 0.30, y: 0.12 }],
    ])
  },

  // 부적귀 — a hovering robe with a blank talisman for a face.
  talismanGhost() {
    return buildMerged([
      [new THREE.CylinderGeometry(0.16, 0.42, 0.90, 8), { y: 0.62 }],
      [new THREE.BoxGeometry(0.34, 0.50, 0.05), { y: 1.24, z: 0.06 }],
      [new THREE.BoxGeometry(0.16, 0.16, 0.16), { x: -0.34, y: 0.86, rz: 0.4 }],
      [new THREE.BoxGeometry(0.16, 0.16, 0.16), { x: 0.34, y: 0.86, rz: -0.4 }],
    ])
  },

  // 혈갈 — flattened body, splayed legs, a segmented tail over the back.
  bloodScorpion() {
    const parts = [
      [new THREE.SphereGeometry(0.40, 10, 8), { y: 0.34, sy: 0.5 }],
    ]
    for (let i = 0; i < 3; i++) {
      const z = -0.1 + i * 0.16
      parts.push([new THREE.BoxGeometry(0.06, 0.06, 0.42), { x: -0.34, y: 0.22, z, ry: 0.5 }])
      parts.push([new THREE.BoxGeometry(0.06, 0.06, 0.42), { x: 0.34, y: 0.22, z, ry: -0.5 }])
    }
    parts.push([new THREE.SphereGeometry(0.17, 8, 6), { y: 0.52, z: -0.34 }])
    parts.push([new THREE.SphereGeometry(0.13, 8, 6), { y: 0.70, z: -0.50 }])
    parts.push([new THREE.ConeGeometry(0.11, 0.26, 5), { y: 0.84, z: -0.60, rx: 1.2 }])
    // Pincers.
    parts.push([new THREE.BoxGeometry(0.10, 0.08, 0.30), { x: -0.28, y: 0.26, z: 0.40, ry: -0.4 }])
    parts.push([new THREE.BoxGeometry(0.10, 0.08, 0.30), { x: 0.28, y: 0.26, z: 0.40, ry: 0.4 }])
    return buildMerged(parts)
  },

  // 마수사 — a humanoid cultivator with a ring of blades at his back.
  demonCultivator() {
    const parts = [
      [new THREE.ConeGeometry(0.50, 1.10, 8), { y: 0.55 }],
      [new THREE.CapsuleGeometry(0.20, 0.30, 4, 8), { y: 1.16 }],
      [new THREE.SphereGeometry(0.26, 10, 8), { y: 1.60 }],
      [new THREE.BoxGeometry(0.34, 0.30, 0.04), { y: 1.60, z: 0.24 }],
    ]
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      parts.push([
        new THREE.BoxGeometry(0.04, 0.42, 0.02),
        { x: Math.cos(a) * 0.52, y: 1.95, z: Math.sin(a) * 0.52 - 0.2, rz: a },
      ])
    }
    return buildMerged(parts)
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
