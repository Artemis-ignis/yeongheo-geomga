import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { buildEnemyGeometry } from './enemyGeometry.js'

/**
 * Hero-distance enemy presentation models.
 *
 * The simulation still uses one InstancedMesh per enemy type.  That is the
 * correct representation for the outer horde, but it is a poor presentation
 * model for the few enemies that are close enough to be judged by the player.
 * This library supplies a bounded eight-slot near LOD: layered materials,
 * rounded silhouettes, and readable emissive landmarks replace the primitive
 * pile only where the camera can actually see the difference.
 */

const _loader = typeof document !== 'undefined' ? new THREE.TextureLoader() : null
const _textureCache = new Map()
const _templateCache = new Map()

export const NEAR_DETAIL_ENEMY_IDS = new Set([
  'wisp', 'wolf', 'stoneGhoul', 'talismanGhost', 'bloodScorpion',
  'demonCultivator', 'jadeSerpent', 'glacierWarden', 'magmaBrute', 'ashRaven',
])
// Keep elite silhouettes detailed for the eight closest readable targets while
// leaving the outer horde on the existing instanced path.
export const NEAR_DETAIL_SLOT_COUNT = 8
export const NEAR_DETAIL_MAX_DISTANCE = 12

const BASE_HEIGHT = {
  wisp: 1.12,
  wolf: 1.06,
  stoneGhoul: 1.68,
  talismanGhost: 1.52,
  bloodScorpion: 1.08,
  demonCultivator: 2.05,
  jadeSerpent: 1.38,
  glacierWarden: 2.30,
  magmaBrute: 1.82,
  ashRaven: 1.42,
}

function assetUrl(file) {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base}assets/${file}`
}

function weaveTexture(file, repeat = [2, 2]) {
  if (!_loader) return null
  let texture = _textureCache.get(file)
  if (texture) return texture
  texture = _loader.load(assetUrl(file))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(...repeat)
  texture.anisotropy = 2
  texture.userData.sharedByNearEnemyModels = true
  _textureCache.set(file, texture)
  return texture
}

function physical(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.48,
    metalness: 0.08,
    clearcoat: 0.16,
    clearcoatRoughness: 0.32,
    ...options,
  })
}

function cloth(color, options = {}) {
  return physical(color, {
    roughness: 0.72,
    sheen: 0.38,
    sheenColor: new THREE.Color(options.sheenColor ?? color),
    ...options,
  })
}

function tube(points, radius, material, tubularSegments = 20, radialSegments = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)))
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false),
    material,
  )
  return mesh
}

function addMesh(root, geometry, material, position = null, scale = null, rotation = null) {
  const mesh = new THREE.Mesh(geometry, material)
  if (position) mesh.position.set(...position)
  if (scale) mesh.scale.set(...scale)
  if (rotation) mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  root.add(mesh)
  return mesh
}

function addGlow(root, position, radius, color, intensity = 1.5) {
  const material = physical(color, {
    color,
    roughness: 0.14,
    metalness: 0.12,
    emissive: color,
    emissiveIntensity: intensity,
    clearcoat: 0.45,
  })
  return addMesh(root, new THREE.SphereGeometry(radius, 20, 14), material, position)
}

function buildWisp() {
  const root = new THREE.Group()
  root.name = 'near-wisp'
  const robe = cloth(0x5f4a9e, { sheenColor: 0xc9b8ff })
  const robeEdge = cloth(0xa28be4, { sheenColor: 0xe9ddff, roughness: 0.54 })
  const voidMat = physical(0x17152c, { roughness: 0.62, metalness: 0.12 })
  const glow = physical(0xff9cdb, { color: 0xff9cdb, emissive: 0xd92a9a, emissiveIntensity: 2.1, roughness: 0.12 })

  const motion = new THREE.Group()
  motion.name = 'near-motion'
  root.add(motion)
  addMesh(motion, new THREE.LatheGeometry([
    new THREE.Vector2(0.02, 0), new THREE.Vector2(0.22, 0.04),
    new THREE.Vector2(0.35, 0.28), new THREE.Vector2(0.38, 0.66),
    new THREE.Vector2(0.30, 0.96), new THREE.Vector2(0.18, 1.12),
    new THREE.Vector2(0.02, 1.18),
  ], 32), robe)
  addMesh(motion, new THREE.SphereGeometry(0.18, 24, 18), voidMat, [0, 0.67, 0.22], [1, 0.86, 0.72])
  for (const side of [-1, 1]) {
    addMesh(motion, new THREE.SphereGeometry(0.05, 16, 12), glow, [side * 0.075, 0.70, 0.385], [1, 1, 0.38])
    motion.add(tube([
      [side * 0.18, 0.58, 0.10], [side * 0.34, 0.40, 0.34], [side * 0.28, 0.24, 0.58],
    ], 0.042, robeEdge, 18, 10))
  }
  const halo = addMesh(motion, new THREE.TorusGeometry(0.42, 0.026, 10, 56), glow, [0, 0.70, -0.04], [1, 1.12, 0.78], [Math.PI / 2, 0, 0])
  halo.name = 'near-halo'
  for (let i = 0; i < 5; i++) {
    const a = -0.8 + i * 0.4
    motion.add(tube([
      [Math.sin(a) * 0.24, 0.20, -0.12],
      [Math.sin(a) * 0.42, 0.10, -0.45 - Math.cos(a) * 0.18],
      [Math.sin(a) * 0.30, 0.03, -0.83 - Math.cos(a) * 0.18],
    ], 0.026, robeEdge, 18, 8))
  }
  return root
}

function buildWolf() {
  const root = new THREE.Group()
  root.name = 'near-wolf'
  const fur = physical(0x7d91a3, { roughness: 0.82, clearcoat: 0.08 })
  const furLight = physical(0xc8d5df, { roughness: 0.74 })
  const armor = physical(0x273b59, { roughness: 0.40, metalness: 0.58, clearcoat: 0.26 })
  const eye = physical(0xffd76a, { color: 0xffd76a, emissive: 0xe88a20, emissiveIntensity: 1.6, roughness: 0.12 })
  const motion = new THREE.Group()
  motion.name = 'near-motion'
  root.add(motion)
  addMesh(motion, new THREE.CapsuleGeometry(0.32, 0.70, 10, 24), fur, [0, 0.50, -0.04], [1.18, 0.78, 1.54], [Math.PI / 2, 0, 0])
  addMesh(motion, new THREE.SphereGeometry(0.30, 24, 18), furLight, [0, 0.66, 0.62], [0.92, 0.88, 1.22])
  addMesh(motion, new THREE.SphereGeometry(0.14, 18, 12), fur, [0, 0.56, 0.92], [0.75, 0.62, 1.25])
  for (const side of [-1, 1]) {
    addMesh(motion, new THREE.ConeGeometry(0.11, 0.26, 14), furLight, [side * 0.17, 0.88, 0.58], [1, 1, 0.72], [side * 0.16, 0, side * -0.12])
    addMesh(motion, new THREE.SphereGeometry(0.052, 16, 12), eye, [side * 0.105, 0.70, 0.84], [1, 1, 0.38])
    addMesh(motion, new THREE.CapsuleGeometry(0.055, 0.34, 6, 12), armor, [side * 0.17, 0.28, 0.28], [1, 1.1, 1], [side * 0.12, 0, side * 0.08])
    addMesh(motion, new THREE.SphereGeometry(0.10, 16, 12), furLight, [side * 0.18, 0.10, 0.31], [1.0, 0.55, 1.25])
  }
  const collar = addMesh(motion, new THREE.TorusGeometry(0.28, 0.045, 10, 40), armor, [0, 0.68, 0.02], [1, 1, 1.15], [Math.PI / 2, 0, 0])
  collar.name = 'near-collar'
  motion.add(tube([[0, 0.48, -0.45], [0.02, 0.68, -0.70], [0.10, 0.86, -0.88]], 0.065, furLight, 18, 10))
  return root
}

function buildDetailedStoneVariant(type, color, emissive, emissiveIntensity) {
  const root = new THREE.Group()
  root.name = `near-${type}`
  const material = physical(0xffffff, {
    color,
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.22,
    clearcoat: 0.28,
    clearcoatRoughness: 0.26,
    emissive,
    emissiveIntensity,
  })
  const body = addMesh(root, buildEnemyGeometry(type), material)
  body.name = 'near-sculpt-body'
  const motion = new THREE.Group()
  motion.name = 'near-motion'
  root.add(motion)
  const core = physical(color, {
    roughness: 0.16,
    metalness: 0.18,
    emissive,
    emissiveIntensity: Math.max(0.8, emissiveIntensity + 0.7),
    clearcoat: 0.42,
  })
  addMesh(motion, new THREE.IcosahedronGeometry(0.12, 1), core, [0, 0.76, 0.64], [1, 1.25, 0.42])
  // The old stone-family LOD was a single rounded mass at play distance. These
  // shared, low-cost armour landmarks give the three variants a readable chest,
  // shoulder and collar silhouette without multiplying the horde draw calls.
  const plate = physical(0xffffff, {
    color: new THREE.Color(color).offsetHSL(0, -0.08, -0.14),
    roughness: 0.38,
    metalness: 0.48,
    clearcoat: 0.34,
  })
  for (const side of [-1, 1]) {
    addMesh(motion, new RoundedBoxGeometry(0.24, 0.34, 0.10, 2, 0.035), plate, [side * 0.24, 0.62, 0.28], [1, 1, 0.9], [0, 0, side * -0.14])
  }
  const collar = addMesh(motion, new THREE.TorusGeometry(0.23, 0.045, 8, 28), plate, [0, 0.76, 0.02], [1, 1, 1.12], [Math.PI / 2, 0, 0])
  collar.name = 'near-stone-collar'
  return root
}

function buildStoneGhoul() {
  return buildDetailedStoneVariant('stoneGhoul', 0xd1c4af, 0x2a2118, 0.04)
}

function buildTalismanGhost() {
  const root = new THREE.Group()
  root.name = 'near-talisman-ghost'
  const silk = cloth(0xd3b982, { sheenColor: 0xfff2c7 })
  const silkDark = cloth(0x80613f, { sheenColor: 0xc9a56f, roughness: 0.62 })
  const paper = physical(0xfff0be, { roughness: 0.56 })
  const seal = physical(0xb32b36, { color: 0xb32b36, emissive: 0x6e0e18, emissiveIntensity: 0.55, roughness: 0.44 })
  const motion = new THREE.Group()
  motion.name = 'near-motion'
  root.add(motion)
  addMesh(motion, new THREE.LatheGeometry([
    new THREE.Vector2(0.03, 0), new THREE.Vector2(0.22, 0.06),
    new THREE.Vector2(0.40, 0.38), new THREE.Vector2(0.34, 0.82),
    new THREE.Vector2(0.27, 1.25), new THREE.Vector2(0.16, 1.45),
    new THREE.Vector2(0.02, 1.52),
  ], 32), silk)
  addMesh(motion, new THREE.SphereGeometry(0.20, 24, 18), silkDark, [0, 1.28, 0.10], [1, 0.94, 0.78])
  const talisman = addMesh(motion, new RoundedBoxGeometry(0.30, 0.48, 0.035, 3, 0.018), paper, [0, 1.26, 0.34], [1, 1, 1], [0, 0, 0])
  talisman.name = 'near-talisman'
  addMesh(motion, new THREE.BoxGeometry(0.045, 0.31, 0.012), seal, [0, 1.26, 0.366])
  for (const y of [1.12, 1.27, 1.42]) addMesh(motion, new THREE.BoxGeometry(0.16, 0.018, 0.012), seal, [0, y, 0.368])
  for (const side of [-1, 1]) {
    motion.add(tube([[side * 0.25, 1.10, 0.03], [side * 0.48, 0.90, 0.22], [side * 0.42, 0.62, 0.42]], 0.13, silk, 18, 10))
    motion.add(tube([[side * 0.14, 0.48, -0.18], [side * 0.20, 0.26, -0.58], [side * 0.12, 0.08, -0.92]], 0.08, silkDark, 18, 8))
  }
  addMesh(motion, new THREE.TorusGeometry(0.36, 0.035, 8, 40), seal, [0, 0.68, 0], [1, 1, 0.9], [Math.PI / 2, 0, 0])
  return root
}

function buildBloodScorpion() {
  const root = new THREE.Group()
  root.name = 'near-blood-scorpion'
  const shell = physical(0x8e2949, { roughness: 0.36, metalness: 0.34, clearcoat: 0.34 })
  const shellLight = physical(0xd35f76, { roughness: 0.34, metalness: 0.22, clearcoat: 0.30 })
  const dark = physical(0x391b2b, { roughness: 0.54, metalness: 0.28 })
  const eye = physical(0xffc35b, { color: 0xffc35b, emissive: 0xff5b1a, emissiveIntensity: 1.8, roughness: 0.10 })
  const motion = new THREE.Group()
  motion.name = 'near-motion'
  root.add(motion)
  addMesh(motion, new THREE.CapsuleGeometry(0.22, 0.58, 10, 22), shell, [0, 0.30, -0.18], [1.22, 0.76, 1.25], [Math.PI / 2, 0, 0])
  addMesh(motion, new THREE.CapsuleGeometry(0.20, 0.42, 10, 20), shellLight, [0, 0.32, 0.32], [1.12, 0.72, 1.05], [Math.PI / 2, 0, 0])
  addMesh(motion, new THREE.SphereGeometry(0.052, 16, 12), eye, [-0.09, 0.43, 0.58], [1, 1, 0.42])
  addMesh(motion, new THREE.SphereGeometry(0.052, 16, 12), eye, [0.09, 0.43, 0.58], [1, 1, 0.42])
  for (let i = 0; i < 5; i++) {
    const t = i / 4
    const y = 0.42 + Math.sin(t * Math.PI) * 0.74
    const z = -0.54 + t * 0.98
    addMesh(motion, new THREE.SphereGeometry(0.13 - t * 0.018, 18, 12), shellLight, [0, y, z], [1, 0.72, 1.12], [0, 0, 0])
    addMesh(motion, new THREE.TorusGeometry(0.13 - t * 0.018, 0.014, 6, 24), dark, [0, y, z], [1, 0.85, 1.08], [Math.PI / 2, 0, 0])
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = -0.32 + i * 0.20
      motion.add(tube([[side * 0.12, 0.30, z], [side * 0.38, 0.22, z + side * 0.05], [side * 0.56, 0.04, z + side * 0.11]], 0.032, shell, 14, 8))
    }
    motion.add(tube([[side * 0.16, 0.34, 0.42], [side * 0.40, 0.28, 0.67], [side * 0.34, 0.22, 0.86]], 0.052, shellLight, 16, 9))
  }
  return root
}

function buildDemonCultivator() {
  const root = new THREE.Group()
  root.name = 'near-demon-cultivator'
  const robe = cloth(0x4e3279, { sheenColor: 0xc29cf0 })
  const robeDark = cloth(0x211735, { sheenColor: 0x7353b2, roughness: 0.60 })
  const mask = physical(0xd8d5ed, { roughness: 0.28, metalness: 0.16, clearcoat: 0.30 })
  const gold = physical(0xd8b45a, { roughness: 0.28, metalness: 0.68, clearcoat: 0.35 })
  const voidGlow = physical(0xd38cff, { color: 0xd38cff, emissive: 0x7e35c5, emissiveIntensity: 1.45, roughness: 0.18 })
  const motion = new THREE.Group()
  motion.name = 'near-motion'
  root.add(motion)
  addMesh(motion, new THREE.LatheGeometry([
    new THREE.Vector2(0.02, 0), new THREE.Vector2(0.30, 0.07),
    new THREE.Vector2(0.50, 0.42), new THREE.Vector2(0.42, 0.98),
    new THREE.Vector2(0.30, 1.52), new THREE.Vector2(0.25, 1.80),
    new THREE.Vector2(0.02, 1.90),
  ], 36), robe)
  addMesh(motion, new THREE.SphereGeometry(0.25, 28, 20), robeDark, [0, 1.86, 0.10], [1, 0.96, 0.82])
  addMesh(motion, new THREE.SphereGeometry(0.23, 28, 20), mask, [0, 1.92, 0.29], [1.0, 0.92, 0.28])
  for (const side of [-1, 1]) {
    motion.add(tube([[side * 0.15, 2.06, 0.14], [side * 0.32, 2.32, -0.04], [side * 0.40, 2.50, -0.30]], 0.052, gold, 18, 10))
    addMesh(motion, new THREE.SphereGeometry(0.045, 16, 12), voidGlow, [side * 0.09, 1.96, 0.36], [1, 1, 0.34])
  }
  const halo = addMesh(motion, new THREE.TorusGeometry(0.64, 0.036, 10, 64), gold, [0, 1.95, -0.22], [1, 1.18, 1], [Math.PI / 2, 0, 0])
  halo.name = 'near-halo'
  for (let i = 0; i < 5; i++) {
    const a = -0.90 + i * 0.45
    const blade = addMesh(motion, new RoundedBoxGeometry(0.06, 0.56 + Math.cos(a) * 0.16, 0.035, 3, 0.012), voidGlow, [Math.sin(a) * 0.72, 1.74 + Math.cos(a) * 0.28, -0.36], [1, 1, 1], [0, 0, a * 0.35])
    blade.name = 'near-floating-blade'
  }
  return root
}

function buildJadeSerpent() {
  const root = new THREE.Group()
  root.name = 'near-jade-serpent'
  const scale = physical(0x2a9c95, {
    roughness: 0.30,
    metalness: 0.16,
    clearcoat: 0.42,
    map: weaveTexture('materials/guardians/jade-void-armor-v1.png', [1.85, 1.35]),
  })
  const belly = physical(0xa9ded1, { roughness: 0.35, clearcoat: 0.30 })
  const horn = physical(0xc6eee8, { roughness: 0.25, metalness: 0.18, clearcoat: 0.38 })
  const eye = physical(0xffd85b, { color: 0xffd85b, emissive: 0x8f6511, emissiveIntensity: 1.6, roughness: 0.12 })
  const motion = new THREE.Group()
  motion.name = 'near-motion'
  root.add(motion)
  const path = [
    [-0.60, 0.12, -0.34], [0.20, 0.12, -0.50], [0.52, 0.18, 0.04],
    [0.18, 0.34, 0.38], [-0.12, 0.62, 0.26], [0.02, 0.90, 0.48],
  ]
  motion.add(tube(path, 0.16, scale, 36, 18))
  for (let i = 0; i < path.length - 1; i++) {
    const [x, y, z] = path[i]
    addMesh(motion, new THREE.SphereGeometry(0.18, 20, 14), belly, [x, y - 0.09, z + 0.12], [0.65, 0.18, 0.82], [0, -i * 0.2, 0])
  }
  const neck = path[path.length - 1]
  addMesh(motion, new THREE.SphereGeometry(0.30, 28, 20), scale, [neck[0], neck[1] + 0.20, neck[2] + 0.09], [0.88, 0.78, 1.12])
  addMesh(motion, new THREE.SphereGeometry(0.17, 22, 16), belly, [neck[0], neck[1] + 0.14, neck[2] + 0.38], [0.84, 0.54, 1.18])
  for (const side of [-1, 1]) {
    addMesh(motion, new THREE.SphereGeometry(0.045, 16, 12), eye, [neck[0] + side * 0.10, neck[1] + 0.34, neck[2] + 0.34], [1, 1, 0.34])
    motion.add(tube([[neck[0] + side * 0.16, neck[1] + 0.48, neck[2] + 0.04], [neck[0] + side * 0.34, neck[1] + 0.70, neck[2] - 0.05], [neck[0] + side * 0.24, neck[1] + 0.88, neck[2] - 0.16]], 0.050, horn, 16, 10))
  }
  return root
}

function buildGlacierWarden() {
  return buildDetailedStoneVariant('glacierWarden', 0xb9edff, 0x2c9cc8, 0.16)
}

function buildMagmaBrute() {
  return buildDetailedStoneVariant('magmaBrute', 0x8b463b, 0xd23e16, 0.22)
}

function buildAshRaven() {
  const root = buildDemonCultivator()
  root.name = 'near-ash-raven'
  root.scale.set(0.80, 0.76, 0.80)
  root.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (material.color) material.color.setHex(0x713c4e)
      if (material.emissive) material.emissive.setHex(0xe6442e)
    }
  })
  return root
}

const BUILDERS = {
  wisp: buildWisp,
  wolf: buildWolf,
  stoneGhoul: buildStoneGhoul,
  talismanGhost: buildTalismanGhost,
  bloodScorpion: buildBloodScorpion,
  demonCultivator: buildDemonCultivator,
  jadeSerpent: buildJadeSerpent,
  glacierWarden: buildGlacierWarden,
  magmaBrute: buildMagmaBrute,
  ashRaven: buildAshRaven,
}

function prepareTemplate(type) {
  const builder = BUILDERS[type]
  if (!builder) return null
  const root = builder()
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  const size = bounds.getSize(new THREE.Vector3())
  const targetHeight = BASE_HEIGHT[type] ?? Math.max(0.8, size.y)
  const scale = targetHeight / Math.max(0.001, size.y)
  root.scale.multiplyScalar(scale)
  root.position.y -= bounds.min.y * scale
  root.userData.nearDetailTemplate = true
  root.userData.detailType = type
  root.updateMatrixWorld(true)
  return root
}

export function createNearEnemyModel(type, variantScale = 1) {
  if (!NEAR_DETAIL_ENEMY_IDS.has(type)) return null
  if (!_templateCache.has(type)) _templateCache.set(type, prepareTemplate(type))
  const template = _templateCache.get(type)
  if (!template) return null
  const root = template.clone(true)
  root.name = `near-enemy-${type}`
  root.scale.multiplyScalar(variantScale)
  root.userData.nearDetailTemplate = false
  root.userData.detailType = type
  return root
}

export function updateNearEnemyModel(root, time, speed01 = 0, phase = 0) {
  if (!root) return
  root.userData.detailPhase = phase
  const motion = root.getObjectByName('near-motion')
  if (motion) {
    motion.position.y = Math.sin(time * (2.8 + speed01 * 2.4) + phase) * (0.012 + speed01 * 0.025)
    motion.rotation.z = Math.sin(time * 1.7 + phase) * (0.012 + speed01 * 0.022)
  }
  const halo = root.getObjectByName('near-halo')
  if (halo) halo.rotation.z = time * 0.55 + phase
}

export function disposeNearEnemyModelLibrary() {
  for (const root of _templateCache.values()) {
    root.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (!object.material) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) material.dispose()
    })
  }
  _templateCache.clear()
  for (const texture of _textureCache.values()) texture.dispose()
  _textureCache.clear()
}
