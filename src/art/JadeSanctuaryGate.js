import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createJadeSanctuaryGateModel } from './generated/JadeSanctuaryGateFactory.ts'

const _dummy = new THREE.Object3D()
const _up = new THREE.Vector3(0, 1, 0)
const _direction = new THREE.Vector3()

function createSurfaceMaps(size = 64) {
  const normal = new Uint8Array(size * size * 4)
  const roughness = new Uint8Array(size * size * 4)
  const noise = (x, y) => {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return value - Math.floor(value)
  }
  const sample = (x, y) => {
    const a = noise(x * 0.12, y * 0.12)
    const b = noise(x * 0.035 + 19, y * 0.035 + 7)
    return a * 0.36 + b * 0.64
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const left = sample(x - 1, y)
      const right = sample(x + 1, y)
      const down = sample(x, y - 1)
      const up = sample(x, y + 1)
      normal[i] = Math.round(128 + (left - right) * 72)
      normal[i + 1] = Math.round(128 + (down - up) * 72)
      normal[i + 2] = 255
      normal[i + 3] = 255
      const value = Math.round(112 + sample(x, y) * 78)
      roughness[i] = value
      roughness[i + 1] = value
      roughness[i + 2] = value
      roughness[i + 3] = 255
    }
  }
  const make = (data) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    texture.colorSpace = THREE.NoColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2.5, 3.0)
    texture.needsUpdate = true
    return texture
  }
  return { normal: make(normal), roughness: make(roughness) }
}

function physical(color, maps, options = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.52,
    metalness: options.metalness ?? 0.16,
    clearcoat: options.clearcoat ?? 0.12,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.28,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    normalMap: maps.normal,
    roughnessMap: maps.roughness,
    normalScale: new THREE.Vector2(options.normalScale ?? 0.22, options.normalScale ?? 0.22),
  })
  material.userData.gateMaterialFamily = options.family ?? 'stone'
  return material
}

function addMesh(parent, geometry, material, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function addBox(parent, name, size, material, position, bevel = 0.06, rotation = [0, 0, 0]) {
  return addMesh(
    parent,
    new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(bevel, Math.min(size[0], size[1], size[2]) * 0.42)),
    material,
    name,
    position,
    rotation,
  )
}

function addCylinder(parent, name, radius, height, material, position, radialSegments = 12, scale = [1, 1, 1]) {
  const mesh = addMesh(parent, new THREE.CylinderGeometry(radius, radius * 1.06, height, radialSegments), material, name, position)
  mesh.scale.set(...scale)
  return mesh
}

function addCurve(parent, name, points, radius, material, tubularSegments = 14, radialSegments = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)))
  return addMesh(parent, new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false), material, name)
}

function addBeamBetween(parent, name, start, end, width, material) {
  const a = new THREE.Vector3(...start)
  const b = new THREE.Vector3(...end)
  _direction.copy(b).sub(a)
  const length = _direction.length()
  const mesh = addBox(parent, name, [width, length, width], material, [0, 0, 0], width * 0.25)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(_up, _direction.normalize())
  return mesh
}

function addRoofTileField(parent, name, baseY, width, depth, material, count = 0) {
  const rows = 5
  const columns = 18
  const total = rows * columns * 2
  const geometry = new THREE.CapsuleGeometry(0.105, 0.40, 3, 8)
  const tiles = new THREE.InstancedMesh(geometry, material, total)
  tiles.name = name
  tiles.castShadow = true
  tiles.receiveShadow = true
  let index = 0
  for (const side of [-1, 1]) {
    for (let row = 0; row < rows; row++) {
      const t = row / (rows - 1)
      const z = side * (0.30 + t * depth)
      const y = baseY + 0.32 - t * 0.56
      for (let column = 0; column < columns; column++) {
        const x = (column / (columns - 1) - 0.5) * width
        _dummy.position.set(x, y, z)
        _dummy.rotation.set(side * 0.28, 0, Math.PI / 2)
        _dummy.scale.set(1, 0.92 + (1 - t) * 0.10, 1)
        _dummy.updateMatrix()
        tiles.setMatrixAt(index++, _dummy.matrix)
      }
    }
  }
  tiles.count = count || total
  tiles.instanceMatrix.needsUpdate = true
  parent.add(tiles)
  return tiles
}

function addLantern(parent, name, x, z, stone, bronze, glow, lights) {
  const lantern = new THREE.Group()
  lantern.name = name
  lantern.position.set(x, 0, z)
  parent.add(lantern)
  addBox(lantern, `${name}-base`, [0.74, 0.20, 0.74], bronze, [0, 0.34, 0], 0.05)
  addBox(lantern, `${name}-body`, [0.56, 0.72, 0.56], stone, [0, 0.82, 0], 0.07)
  addBox(lantern, `${name}-glow`, [0.30, 0.44, 0.30], glow, [0, 0.82, 0], 0.035)
  for (const side of [-1, 1]) {
    addBox(lantern, `${name}-bar-x-${side}`, [0.065, 0.75, 0.065], bronze, [side * 0.25, 0.82, 0], 0.02)
    addBox(lantern, `${name}-bar-z-${side}`, [0.065, 0.75, 0.065], bronze, [0, 0.82, side * 0.25], 0.02)
  }
  const cap = new THREE.ConeGeometry(0.46, 0.22, 4)
  addMesh(lantern, cap, bronze, `${name}-cap`, [0, 1.30, 0], [0, Math.PI / 4, 0])
  const finial = new THREE.OctahedronGeometry(0.11, 1)
  addMesh(lantern, finial, bronze, `${name}-finial`, [0, 1.52, 0])
  const light = new THREE.PointLight(0xffc56c, 2.4, 6.5, 2)
  light.position.set(0, 0.84, 0)
  lantern.add(light)
  lights.push({ light, phase: x * 0.19 + z * 0.07, base: 2.4 })
  return lantern
}

function addPillar(parent, side, materials, detailGroup) {
  const x = side * 4.9
  const pillar = new THREE.Group()
  pillar.name = `${side < 0 ? 'left' : 'right'}-pillar`
  pillar.position.x = x
  parent.add(pillar)

  addBox(pillar, `${pillar.name}-foundation`, [3.15, 0.42, 2.55], materials.stone, [0, 0.22, 0], 0.10)
  addBox(pillar, `${pillar.name}-foundation-step-1`, [2.82, 0.30, 2.28], materials.stoneEdge, [0, 0.57, 0], 0.08)
  addBox(pillar, `${pillar.name}-foundation-step-2`, [2.50, 0.24, 2.05], materials.bronze, [0, 0.84, 0], 0.06)
  addBox(pillar, `${pillar.name}-column`, [1.72, 5.42, 1.45], materials.stone, [0, 3.70, 0], 0.12)
  addBox(pillar, `${pillar.name}-column-front-relief`, [0.62, 4.20, 0.14], materials.bronze, [0, 3.72, 0.76], 0.04)
  addBox(pillar, `${pillar.name}-column-jade-inlay`, [0.35, 3.26, 0.08], materials.jade, [0, 3.70, 0.87], 0.03)

  for (const [dx, dz] of [[-0.62, -0.46], [0.62, -0.46], [-0.62, 0.46], [0.62, 0.46]]) {
    addCylinder(pillar, `${pillar.name}-flute-${dx}-${dz}`, 0.115, 5.06, materials.stoneEdge, [dx, 3.70, dz], 10)
  }
  for (const [y, radius] of [[2.15, 0.28], [3.70, 0.30], [5.25, 0.25]]) {
    const medallion = addMesh(
      pillar,
      new THREE.TorusGeometry(radius, 0.045, 7, 22),
      materials.jade,
      `${pillar.name}-medallion-${y}`,
      [0, y, 0.92],
      [0, 0, 0],
    )
    medallion.scale.y = 1.16
    addMesh(pillar, new THREE.OctahedronGeometry(radius * 0.54, 1), materials.bronze, `${pillar.name}-medallion-core-${y}`, [0, y, 0.96])
  }
  addBox(pillar, `${pillar.name}-capital`, [2.12, 0.30, 1.82], materials.bronze, [0, 6.54, 0], 0.07)
  addBox(pillar, `${pillar.name}-capital-top`, [2.55, 0.22, 2.04], materials.stoneEdge, [0, 6.82, 0], 0.06)
  detailGroup.add(pillar)
  return pillar
}

// The official img2threejs generator emits a pass-gated macro blockout with
// unit-sized primitive cages. The game adapter gives those generated meshes
// the measured sanctuary dimensions once, then reuses the result as an actual
// emergency LOD instead of pretending the generator output is a hero render.
const FACTORY_BLOCKOUT_DIMENSIONS = {
  root: [12.6, 0.38, 2.65],
  'left-pillar': [1.72, 6.80, 1.45],
  'right-pillar': [1.72, 6.80, 1.45],
  crossbeam: [11.4, 0.72, 1.28],
  roof: [13.8, 0.86, 5.10],
  stairs: [4.8, 1.10, 3.20],
}

function adaptFactoryBlockout(model) {
  const meshes = model.userData.sculptRuntime?.meshes ?? {}
  for (const [componentId, dimensions] of Object.entries(FACTORY_BLOCKOUT_DIMENSIONS)) {
    const mesh = meshes[componentId]
    if (!mesh?.geometry) continue
    mesh.geometry.scale(...dimensions)
    mesh.userData.runtimeDimensions = dimensions
  }
  for (const componentId of ['left-pillar', 'right-pillar']) {
    const node = model.userData.sculptRuntime?.nodes?.[componentId]
    if (node) node.position.y = 3.40
  }
  model.userData.runtimeDimensions = FACTORY_BLOCKOUT_DIMENSIONS
  model.userData.generatedBy = {
    repository: 'https://github.com/img2threejs/img2threejs',
    sourceCommit: 'd6673386f89673a58736f8d398dd16ece67874f5',
    buildPass: 'blockout',
    role: 'emergency-geometry-lod',
  }
  return model
}

function collectMaterialTextures(root) {
  const textures = new Set()
  const textureKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'emissiveMap']
  root.traverse((object) => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      for (const key of textureKeys) {
        const texture = material?.[key]
        if (texture) textures.add(texture)
      }
    }
  })
  return [...textures]
}

/**
 * Collapse the gate's authored static pieces into a handful of material-batched
 * meshes. The img2threejs factory remains in the asset graph and the moving
 * crest/roof-tile instances stay separate, but 100+ unmoving stone pieces do
 * not need 100+ WebGL submissions every frame. This is a render optimization,
 * not a visual simplification: the transformed source geometry is preserved.
 */
function batchStaticGateMeshes(root) {
  root.updateMatrixWorld(true)
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const batches = new Map()
  const sourceGeometries = new Set()
  const retainedGeometries = new Set()

  const isVisibleThroughParents = (object) => {
    for (let current = object; current && current !== root; current = current.parent) {
      if (!current.visible) return false
    }
    return true
  }

  const isDynamicOrInstanced = (object) => {
    if (object.isInstancedMesh) return true
    for (let current = object.parent; current && current !== root; current = current.parent) {
      // The jade crest rotates during the ambient pass. Keep its small pieces
      // as normal meshes so that animation does not get baked into the batch.
      if (current.name === 'gate-jade-sun-crest') return true
    }
    return false
  }

  const rootChild = (object) => {
    let current = object
    while (current.parent && current.parent !== root) current = current.parent
    return current.parent === root ? current : root
  }

  root.traverse((object) => {
    if (!object.isMesh || !object.geometry || object.isInstancedMesh) {
      if (object.isMesh && object.geometry) retainedGeometries.add(object.geometry)
      return
    }
    if (!object.material?.isMaterial || isDynamicOrInstanced(object) || !isVisibleThroughParents(object)) {
      retainedGeometries.add(object.geometry)
      return
    }

    const source = rootChild(object)
    const attributes = Object.keys(object.geometry.attributes).sort().join(',')
    const indexed = object.geometry.index ? 'indexed' : 'non-indexed'
    const key = `${source.uuid}:${object.material.uuid}:${attributes}:${indexed}`
    let batch = batches.get(key)
    if (!batch) {
      batch = { source, material: object.material, geometries: [] }
      batches.set(key, batch)
    }
    const geometry = object.geometry.clone()
    const relativeMatrix = new THREE.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld)
    geometry.applyMatrix4(relativeMatrix)
    batch.geometries.push(geometry)
    sourceGeometries.add(object.geometry)
    object.visible = false
  })

  const batchedGroups = new Map()
  for (const batch of batches.values()) {
    const merged = batch.geometries.length === 1
      ? batch.geometries[0]
      : mergeGeometries(batch.geometries, false)
    if (!merged) {
      // Keep a safe fallback if a future Three.js geometry introduces an
      // incompatible attribute set. The source pieces were hidden above, so
      // put the transformed clones back as individual meshes.
      for (const geometry of batch.geometries) {
        const mesh = new THREE.Mesh(geometry, batch.material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        let group = batchedGroups.get(batch.source)
        if (!group) {
          group = new THREE.Group()
          group.name = `${batch.source.name || 'gate'}-static-batch`
          root.add(group)
          batchedGroups.set(batch.source, group)
        }
        group.add(mesh)
      }
      continue
    }
    for (const geometry of batch.geometries) {
      if (geometry !== merged) geometry.dispose()
    }
    let group = batchedGroups.get(batch.source)
    if (!group) {
      group = new THREE.Group()
      group.name = `${batch.source.name || 'gate'}-static-batch`
      root.add(group)
      batchedGroups.set(batch.source, group)
    }
    const mesh = new THREE.Mesh(merged, batch.material)
    mesh.name = `${batch.source.name || 'gate'}-material-batch`
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }

  // Do not leave duplicate GPU buffers behind. A geometry shared with an
  // excluded/dynamic mesh is retained, so this remains safe if the asset is
  // extended with a reused geometry in a later pass.
  for (const geometry of sourceGeometries) {
    if (!retainedGeometries.has(geometry)) geometry.dispose()
  }
  return batchedGroups
}

export function buildJadeSanctuaryGate() {
  const root = new THREE.Group()
  root.name = 'img2three-jade-sanctuary-gate'
  root.userData.assetPipeline = 'img2threejs'
  root.userData.referenceAsset = 'imagegen:jade-sanctuary-gate-reference-v1'
  root.userData.sculptSpec = 'docs/assets/jade-sanctuary-gate-sculpt-spec.json'
  root.userData.qualityTier = 'hero-environment'
  root.userData.renderMode = 'modular-full-3d'
  root.userData.lod = {
    near: 'full roof tile instances, relief medallions, lantern frames',
    far: 'silhouette roof and primary pillars only',
    runtimeBudget: 'under 150 draw calls including the surrounding set',
    emergency: 'official img2threejs blockout factory with six macro meshes',
  }

  const maps = createSurfaceMaps()
  const materials = {
    stone: physical(0x3b4d60, maps, { roughness: 0.66, metalness: 0.16, clearcoat: 0.10, family: 'wet-carved-stone' }),
    stoneEdge: physical(0x718da8, maps, { roughness: 0.52, metalness: 0.24, clearcoat: 0.18, family: 'moonlit-stone-edge' }),
    bronze: physical(0x8b6035, maps, { roughness: 0.36, metalness: 0.78, clearcoat: 0.32, family: 'aged-bronze' }),
    jade: physical(0x35c8ad, maps, { roughness: 0.25, metalness: 0.18, clearcoat: 0.48, emissive: 0x0a8f7a, emissiveIntensity: 0.48, family: 'jade-inlay' }),
    roof: physical(0x24405e, maps, { roughness: 0.46, metalness: 0.30, clearcoat: 0.28, family: 'glazed-roof-tile' }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffc66f, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending }),
  }
  const lights = []
  const generatedBlockout = adaptFactoryBlockout(createJadeSanctuaryGateModel({
    qualityPriority: 'balanced',
    textureSize: 256,
    textureAnisotropy: 2,
  }))
  generatedBlockout.name = 'img2threejs-official-gate-blockout-lod'
  generatedBlockout.visible = false
  root.add(generatedBlockout)
  const moonFill = new THREE.DirectionalLight(0x90bfff, 4.6)
  moonFill.position.set(-7.5, 9.5, 8.0)
  moonFill.target.position.set(0, 4.2, 0)
  moonFill.castShadow = false
  root.add(moonFill)
  root.add(moonFill.target)
  const jadeRim = new THREE.PointLight(0x39e6d0, 5.0, 18, 2)
  jadeRim.position.set(0, 4.0, 2.6)
  root.add(jadeRim)
  lights.push({ light: moonFill, phase: 0.4, base: 4.6 })
  lights.push({ light: jadeRim, phase: 1.1, base: 5.0 })
  const foundation = new THREE.Group()
  foundation.name = 'gate-foundation-and-stairs'
  root.add(foundation)
  addBox(foundation, 'foundation-back-sill', [12.6, 0.38, 2.65], materials.stone, [0, 0.20, -0.12], 0.10)
  for (let i = 0; i < 5; i++) {
    addBox(foundation, `ceremonial-step-${i}`, [4.8 - i * 0.15, 0.18, 0.64], materials.stoneEdge, [0, 0.16 + i * 0.18, 2.00 - i * 0.52], 0.045)
  }
  for (const side of [-1, 1]) {
    addBeamBetween(foundation, `stair-rail-${side}`, [side * 2.22, 0.33, 2.26], [side * 2.0, 1.20, 0.18], 0.13, materials.bronze)
    for (let i = 0; i < 3; i++) {
      const t = i / 2
      addCylinder(foundation, `stair-post-${side}-${i}`, 0.11, 0.72, materials.bronze, [side * (2.22 - t * 0.22), 0.36 + t * 0.43, 2.26 - t * 2.08], 10)
    }
    addMesh(foundation, new THREE.OctahedronGeometry(0.19, 1), materials.jade, `stair-jade-${side}`, [side * 2.0, 1.31, 0.18])
  }

  const detailGroup = new THREE.Group()
  detailGroup.name = 'gate-meso-micro-detail'
  root.add(detailGroup)
  addPillar(detailGroup, -1, materials, detailGroup)
  addPillar(detailGroup, 1, materials, detailGroup)

  const superstructure = new THREE.Group()
  superstructure.name = 'gate-crossbeam-and-brackets'
  root.add(superstructure)
  addBox(superstructure, 'crossbeam-primary', [11.4, 0.72, 1.28], materials.stoneEdge, [0, 7.12, 0], 0.12)
  addBox(superstructure, 'crossbeam-bronze-face', [9.60, 0.22, 1.38], materials.bronze, [0, 7.18, 0.68], 0.05)
  addBox(superstructure, 'crossbeam-shadow-pocket', [7.45, 0.96, 0.22], materials.stone, [0, 6.52, 0.70], 0.06)
  addBox(superstructure, 'crossbeam-jade-line', [7.30, 0.10, 0.08], materials.jade, [0, 6.72, 0.86], 0.025)
  for (const side of [-1, 1]) {
    addBeamBetween(superstructure, `bracket-${side}-outer`, [side * 4.4, 6.50, 0.42], [side * 3.45, 7.18, 0.46], 0.22, materials.bronze)
    addBeamBetween(superstructure, `bracket-${side}-inner`, [side * 3.55, 6.58, 0.48], [side * 2.90, 7.16, 0.50], 0.16, materials.stoneEdge)
  }

  const crest = new THREE.Group()
  crest.name = 'gate-jade-sun-crest'
  crest.position.set(0, 7.08, 0.90)
  superstructure.add(crest)
  const crestRing = addMesh(crest, new THREE.TorusGeometry(0.58, 0.075, 9, 32), materials.bronze, 'crest-ring')
  crestRing.rotation.y = 0
  addMesh(crest, new THREE.TorusGeometry(0.39, 0.035, 7, 24), materials.jade, 'crest-jade-ring')
  addMesh(crest, new THREE.OctahedronGeometry(0.23, 2), materials.jade, 'crest-core', [0, 0, 0.06], [0, 0.2, Math.PI / 4])
  for (const side of [-1, 1]) {
    const pendant = new THREE.Group()
    pendant.name = `jade-pendant-${side}`
    pendant.position.set(side * 1.65, 6.04, 0.84)
    superstructure.add(pendant)
    addCylinder(pendant, `pendant-chain-${side}`, 0.025, 0.72, materials.bronze, [0, 0.35, 0], 8)
    addMesh(pendant, new THREE.TorusGeometry(0.24, 0.035, 7, 20), materials.jade, `pendant-ring-${side}`, [0, -0.04, 0])
    addMesh(pendant, new THREE.OctahedronGeometry(0.12, 1), materials.jade, `pendant-gem-${side}`, [0, -0.30, 0.03])
  }
  addCylinder(superstructure, 'crest-pendant-chain', 0.027, 0.75, materials.bronze, [0, 6.05, 0.86], 8)
  addMesh(superstructure, new THREE.TorusGeometry(0.24, 0.038, 7, 20), materials.jade, 'crest-pendant-ring', [0, 5.62, 0.87])
  addMesh(superstructure, new THREE.OctahedronGeometry(0.14, 1), materials.jade, 'crest-pendant-gem', [0, 5.35, 0.90])

  const roof = new THREE.Group()
  roof.name = 'gate-upturned-tiled-roof'
  root.add(roof)
  for (const [level, baseY, width, depth] of [[0, 7.92, 13.8, 2.55], [1, 8.68, 10.2, 1.90]]) {
    for (const side of [-1, 1]) {
      const panel = addBox(roof, `roof-panel-${level}-${side}`, [width, 0.24, depth + 0.34], materials.roof, [0, baseY - 0.22, side * (depth * 0.50)], 0.08, [side * 0.28, 0, 0])
      panel.castShadow = true
    }
    addBox(roof, `roof-ridge-${level}`, [width * 0.84, 0.34, 0.48], materials.bronze, [0, baseY + 0.40, 0], 0.08)
    addRoofTileField(roof, `roof-tile-instances-${level}`, baseY, width * 0.94, depth, materials.roof)
    for (const side of [-1, 1]) {
      addCurve(roof, `upturned-eave-${level}-${side}`, [
        [side * (width * 0.44), baseY - 0.08, side * depth * 0.92],
        [side * (width * 0.51), baseY + 0.10, side * depth * 0.98],
        [side * (width * 0.57), baseY + 0.56, side * depth * 0.74],
      ], 0.115, materials.bronze, 15, 8)
    }
  }
  addMesh(roof, new THREE.ConeGeometry(0.18, 0.66, 6), materials.jade, 'roof-ridge-jade-finial', [0, 9.50, 0])
  for (const side of [-1, 1]) {
    addCurve(roof, `roof-ridge-tail-${side}`, [
      [side * 4.6, 9.22, 0], [side * 5.55, 9.36, 0], [side * 6.28, 9.82, 0.05],
    ], 0.13, materials.bronze, 18, 8)
    addMesh(roof, new THREE.OctahedronGeometry(0.20, 1), materials.jade, `roof-tail-jade-${side}`, [side * 6.30, 9.83, 0.05])
  }

  addLantern(root, 'front-lantern-left', -3.25, 0.62, materials.stone, materials.bronze, materials.glow, lights)
  addLantern(root, 'front-lantern-right', 3.25, 0.62, materials.stone, materials.bronze, materials.glow, lights)
  addLantern(root, 'side-lantern-left', -6.65, -0.05, materials.stone, materials.bronze, materials.glow, lights)
  addLantern(root, 'side-lantern-right', 6.65, -0.05, materials.stone, materials.bronze, materials.glow, lights)

  const farDetails = new THREE.Group()
  farDetails.name = 'gate-far-silhouette-details'
  root.add(farDetails)
  for (const side of [-1, 1]) {
    addBox(farDetails, `far-banner-pole-${side}`, [0.12, 7.5, 0.12], materials.bronze, [side * 7.75, 3.75, -0.18], 0.03)
    addBox(farDetails, `far-banner-${side}`, [1.45, 3.50, 0.05], materials.stone, [side * 7.75, 4.55, -0.12], 0.02)
    addMesh(farDetails, new THREE.OctahedronGeometry(0.24, 1), materials.jade, `far-banner-jade-${side}`, [side * 7.75, 4.55, -0.22])
  }

  const tileMeshes = roof.children.filter((child) => child.isInstancedMesh)
  root.userData.ownedTextures = [maps.normal, maps.roughness]
  root.userData.ownedTextures.push(...collectMaterialTextures(generatedBlockout))
  root.userData.lights = lights
  root.userData.detailGroup = detailGroup
  root.userData.tileMeshes = tileMeshes
  root.userData.generatedBlockout = generatedBlockout
  root.userData.heroGroups = [foundation, detailGroup, superstructure, roof]
  const batchedGroups = batchStaticGateMeshes(root)
  root.userData.batchedGroups = batchedGroups
  root.userData.setQuality = (scale) => {
    const high = scale >= 0.72
    const medium = scale >= 0.58
    const emergency = scale < 0.48
    generatedBlockout.visible = emergency
    for (const group of root.userData.heroGroups) group.visible = !emergency
    for (const [source, batch] of batchedGroups) batch.visible = source.visible && !emergency
    detailGroup.visible = medium
    const detailBatch = batchedGroups.get(detailGroup)
    if (detailBatch) detailBatch.visible = medium && !emergency
    for (const tile of tileMeshes) tile.visible = high
    farDetails.visible = true
    for (const tile of tileMeshes) tile.count = high ? tile.instanceMatrix.count : Math.max(36, Math.floor(tile.instanceMatrix.count * 0.46))
  }
  root.userData.update = (dt) => {
    const time = root.userData.time = (root.userData.time ?? 0) + dt
    for (const item of lights) item.light.intensity = item.base * (0.88 + Math.sin(time * 2.2 + item.phase) * 0.12)
    materials.jade.emissiveIntensity = 0.26 + Math.sin(time * 1.3) * 0.035
    crest.rotation.z = Math.sin(time * 0.28) * 0.025
  }

  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  return root
}
