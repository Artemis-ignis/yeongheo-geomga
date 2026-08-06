import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { makeFlatMaterial } from './materials.js'
import { faceSet } from './faces.js'

const _forward = new THREE.Vector3()

const _heroicTextureLoader = typeof document !== 'undefined' ? new THREE.TextureLoader() : null
const _heroicTextureCache = new Map()

function weaveTexture(file, repeat = [2, 2], colorSpace = THREE.SRGBColorSpace) {
  if (!_heroicTextureLoader) return null
  const key = `${file}|${repeat[0]}|${repeat[1]}`
  const cached = _heroicTextureCache.get(key)
  if (cached) return cached
  const base = import.meta.env?.BASE_URL ?? '/'
  const texture = _heroicTextureLoader.load(`${base}assets/${file}`)
  texture.colorSpace = colorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.anisotropy = 2
  texture.userData.sharedByHeroicModels = true
  _heroicTextureCache.set(key, texture)
  return texture
}

function standard(color, { roughness = 0.45, metalness = 0.05, emissive = 0x000000, emissiveIntensity = 0, clearcoat = 0, map = null } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    map,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    clearcoat,
    clearcoatRoughness: 0.22,
  })
}

function cloth(color, accent = 0x96dfff, map = null) {
  const options = arguments[3] ?? {}
  return new THREE.MeshPhysicalMaterial({
    color,
    map,
    normalMap: options.normalMap ?? null,
    roughnessMap: options.roughnessMap ?? null,
    bumpMap: options.bumpMap ?? null,
    bumpScale: options.bumpScale ?? 0.035,
    roughness: 0.58,
    metalness: 0.02,
    sheen: 0.42,
    sheenColor: new THREE.Color(accent),
    sheenRoughness: 0.48,
    clearcoat: 0.08,
    clearcoatRoughness: 0.42,
    side: THREE.DoubleSide,
  })
}

function tube(points, radius, material, tubularSegments = 18, radialSegments = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
  return new THREE.Mesh(new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false), material)
}

function panel(width, height, material, bend = 0.18) {
  const geo = new THREE.PlaneGeometry(width, height, 5, 8)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const t = (y + height * 0.5) / height
    pos.setZ(i, -bend * (1 - t) * (1 - t) + Math.sin(t * Math.PI) * 0.035 * Math.sign(x || 1))
    pos.setX(i, x * (0.76 + t * 0.24))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

function blade(material, length = 0.90) {
  const shape = new THREE.Shape()
  shape.moveTo(-0.035, 0)
  shape.lineTo(0.035, 0)
  shape.lineTo(0.105, length * 0.61)
  shape.lineTo(0.0, length)
  shape.lineTo(-0.105, length * 0.61)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelThickness: 0.012,
    bevelSize: 0.012,
  })
  geo.center()
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  return mesh
}

function addEyePair(root, material, y, z, spacing = 0.12, radius = 0.035) {
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material)
    eye.position.set(side * spacing, y, z)
    eye.scale.z = 0.38
    root.add(eye)
  }
}

function faceShellGeometry(radius) {
  // A curved, UV-normalised face shell keeps the authored anime features on the
  // front of the head without the sticker-flat look of a plane.
  const phiLength = 1.92
  const thetaStart = 0.62
  const thetaLength = 1.86
  const geo = new THREE.SphereGeometry(
    radius, 24, 18,
    Math.PI / 2 - phiLength / 2, phiLength,
    thetaStart, thetaLength,
  )
  const uv = geo.attributes.uv
  let minU = Infinity; let maxU = -Infinity
  let minV = Infinity; let maxV = -Infinity
  for (let i = 0; i < uv.count; i++) {
    minU = Math.min(minU, uv.getX(i)); maxU = Math.max(maxU, uv.getX(i))
    minV = Math.min(minV, uv.getY(i)); maxV = Math.max(maxV, uv.getY(i))
  }
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(
      i,
      1 - (uv.getX(i) - minU) / (maxU - minU),
      (uv.getY(i) - minV) / (maxV - minV),
    )
  }
  uv.needsUpdate = true
  return geo
}

export function buildHeroicSeolryeong(character) {
  const pal = character.palette
  const root = new THREE.Group()
  root.name = 'heroic-seolryeong'
  // The gameplay camera sits high above the court. A slightly taller silhouette
  // keeps the layered robe, shoulders and sword readable instead of reducing her
  // to the old thumbnail-sized chibi marker.
  root.scale.setScalar(1.32)

  const skin = standard(pal.skin ?? 0xf4c9ae, { roughness: 0.62 })
  // The reference has a dark blue-black hair mass with a silver-blue edge. The
  // old shell used the palette's light highlight for the whole cap, which made
  // hair and robe collapse into one beige silhouette under the stage sun.
  const hair = standard(pal.hairRoot ?? 0x1b2944, { roughness: 0.3, metalness: 0.08, clearcoat: 0.28 })
  const hairHighlight = standard(pal.hair ?? 0x9fb8d6, { roughness: 0.28, metalness: 0.12, clearcoat: 0.42 })
  // The reference silhouette is a moonlit white-robed swordswoman. Keep the
  // character palette's blue as an accent, but do not let it turn the entire
  // robe into a navy blob under the night grade.
  const silkWeave = weaveTexture('materials/characters/moon-silk-weave-v1.png', [2.35, 3.1])
  const silkNormal = weaveTexture('materials/img2three/seolryeong-silk_normal.png', [2.35, 3.1], THREE.NoColorSpace)
  const silkRoughness = weaveTexture('materials/img2three/seolryeong-silk_roughness.png', [2.35, 3.1], THREE.NoColorSpace)
  const silkMaps = { normalMap: silkNormal, roughnessMap: silkRoughness, bumpMap: silkNormal, bumpScale: 0.018 }
  const silk = cloth(0xf0f6ff, pal.accent ?? 0x86d8ff, silkWeave, silkMaps)
  const silkBlue = cloth(0x5f86b7, 0x7adfff, silkWeave, silkMaps)
  const trim = standard(pal.trim ?? 0xeff7ff, { roughness: 0.32, metalness: 0.3, clearcoat: 0.36 })
  const bladeMat = standard(0xdff7ff, { roughness: 0.18, metalness: 0.88, emissive: 0x6ccfff, emissiveIntensity: 0.22, clearcoat: 0.7 })
  const eyeMat = standard(0x182841, { roughness: 0.2, emissive: 0x58dfff, emissiveIntensity: 0.55 })

  const skirt = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.12, 1.32), new THREE.Vector2(0.31, 1.20),
    new THREE.Vector2(0.42, 0.84), new THREE.Vector2(0.52, 0.28),
    new THREE.Vector2(0.44, 0.06), new THREE.Vector2(0.0, 0.0),
  ], 32), silk)
  skirt.castShadow = true
  root.add(skirt)

  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 10, 40), trim)
  sash.rotation.x = Math.PI / 2
  sash.position.y = 1.28
  root.add(sash)

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.54, 10, 24), silkBlue)
  torso.position.y = 1.35
  torso.scale.set(0.90, 1.0, 0.68)
  torso.castShadow = true
  root.add(torso)

  const bib = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 8, 18), silk)
  bib.position.set(0, 1.43, 0.245)
  bib.scale.set(0.85, 1, 0.18)
  root.add(bib)

  for (const side of [-1, 1]) {
    const sleeve = tube([
      [side * 0.22, 1.57, 0], [side * 0.43, 1.42, 0.05],
      [side * 0.56, 1.10, 0.16], [side * 0.48, 0.84, 0.26],
    ], 0.14, silk, 16, 12)
    sleeve.castShadow = true
    root.add(sleeve)
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 24), trim)
    cuff.rotation.y = Math.PI / 2
    cuff.position.set(side * 0.49, 0.88, 0.27)
    root.add(cuff)
  }

  for (const side of [-1, 1]) {
    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.30, 8, 16), silkBlue)
    boot.position.set(side * 0.16, 0.21, 0.12)
    boot.scale.set(0.88, 1, 1.2)
    boot.castShadow = true
    root.add(boot)
  }

  // The gameplay camera is deliberately pitched down. Tip the head toward the
  // lens so the face, not the scalp, is the first read at survivor distance.
  const headRig = new THREE.Group()
  headRig.position.y = 1.75
  headRig.rotation.x = -0.38
  root.add(headRig)

  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.12, 8, 14), skin)
  neck.position.y = 0.03
  headRig.add(neck)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 24), skin)
  head.position.set(0, 0.30, 0.02)
  head.scale.set(0.92, 1.08, 0.86)
  head.castShadow = true
  headRig.add(head)

  const faceMaterial = makeFlatMaterial({ map: faceSet({ ...pal, eye: pal.eye ?? 0x65caff }).idle })
  faceMaterial.transparent = true
  faceMaterial.depthWrite = false
  faceMaterial.side = THREE.DoubleSide
  const face = new THREE.Mesh(faceShellGeometry(0.334), faceMaterial)
  face.renderOrder = 2
  head.add(face)

  // The reference reads as a face in three-quarter light, not as a blue patch
  // on a sphere. Keep the authored expression texture for blush and mouth, but
  // give the eyes a real spherical surface so the gameplay camera catches a
  // specular point and a rim when the head turns.
  const eyeWhite = standard(0xf7fbff, { roughness: 0.24, clearcoat: 0.2 })
  const iris = standard(pal.eye ?? 0x2f9bdd, {
    roughness: 0.16,
    emissive: pal.eye ?? 0x2f9bdd,
    emissiveIntensity: 0.18,
    clearcoat: 0.32,
  })
  for (const side of [-1, 1]) {
    const eyeBall = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), eyeWhite)
    eyeBall.position.set(side * 0.135, 0.31, 0.286)
    eyeBall.scale.z = 0.34
    headRig.add(eyeBall)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.043, 14, 10), iris)
    pupil.position.set(side * 0.135, 0.31, 0.314)
    pupil.scale.z = 0.26
    headRig.add(pupil)
  }

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), hair)
  hairCap.position.set(0, 0.37, -0.04)
  hairCap.scale.set(1.02, 0.90, 0.96)
  headRig.add(hairCap)

  // A tucked lathed hair mass gives the skull a designed silhouette. The open
  // front leaves the face shell readable while the side volume catches the rim
  // light instead of looking like a beige sphere with two ropes attached.
  const hairBack = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.12, -0.30), new THREE.Vector2(0.27, -0.27),
    new THREE.Vector2(0.35, -0.10), new THREE.Vector2(0.36, 0.13),
    new THREE.Vector2(0.32, 0.31), new THREE.Vector2(0.15, 0.42),
  ], 32, 0.62, Math.PI * 2 - 1.24), hair)
  hairBack.position.z = -0.015
  hairBack.castShadow = true
  headRig.add(hairBack)

  // Three tapered fringe locks frame the brow and keep the silver hair visible
  // in the steep gameplay view.
  for (const [x, lean] of [[-0.14, -0.06], [0, 0], [0.14, 0.06]]) {
    const fringe = tube([
      [x, 0.43, 0.19], [x + lean * 0.3, 0.34, 0.29],
      [x + lean, 0.19, 0.23],
    ], 0.055, hair, 14, 10)
    headRig.add(fringe)
  }
  // Silver-blue edge locks catch the rim light and make the hair read as a
  // designed layered asset rather than a single sphere with tubes attached.
  for (const [side, sweep, length] of [[-1, -0.14, 0.86], [1, 0.14, 0.80], [-1, -0.24, 0.62], [1, 0.24, 0.58]]) {
    const lock = tube([
      [side * 0.18, 0.43, 0.08], [side * 0.28 + sweep * 0.18, 0.24, -0.01],
      [side * 0.36 + sweep, 0.06 - length * 0.42, -0.10],
      [side * 0.28 + sweep * 1.1, -0.02 - length, -0.14],
    ], 0.052, hairHighlight, 16, 8)
    headRig.add(lock)
  }
  for (const [side, sweep, length] of [[-1, -0.10, 0.48], [1, 0.10, 0.40], [-1, -0.18, 0.30], [1, 0.18, 0.27]]) {
    const lock = tube([
      [side * 0.16, 0.41, 0.18], [side * 0.24 + sweep * 0.3, 0.24, 0.16],
      [side * 0.31 + sweep, 0.10 - length * 0.30, 0.05],
      [side * 0.26 + sweep * 1.2, 0.03 - length, -0.04],
    ], 0.075, hair, 14, 10)
    lock.scale.x = 0.72
    headRig.add(lock)
  }

  const shoulderLeft = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), trim)
  const shoulderRight = shoulderLeft.clone()
  shoulderLeft.position.set(-0.37, 1.58, 0)
  shoulderRight.position.set(0.37, 1.58, 0)
  shoulderLeft.scale.set(1.2, 0.44, 0.75)
  shoulderRight.scale.copy(shoulderLeft.scale)
  root.add(shoulderLeft, shoulderRight)

  const cloak = panel(0.78, 1.22, silk, 0.30)
  cloak.position.set(0, 0.86, -0.15)
  cloak.rotation.x = 0.08
  root.add(cloak)
  for (const side of [-1, 1]) {
    const panelMesh = panel(0.34, 1.05, silk, 0.22)
    panelMesh.position.set(side * 0.28, 0.82, 0.17)
    panelMesh.rotation.y = side * 0.14
    root.add(panelMesh)
  }

  const frontPanel = panel(0.26, 0.86, trim, 0.06)
  frontPanel.position.set(0, 1.00, 0.38)
  frontPanel.rotation.x = -0.05
  root.add(frontPanel)
  const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 1), bladeMat)
  clasp.position.set(0, 1.32, 0.43)
  clasp.rotation.z = Math.PI / 4
  root.add(clasp)

  // Layered brocade panels and tassels give the robe a readable silhouette from
  // the steep gameplay camera. They are curved meshes, not flat billboard cards,
  // so the folds still catch the key light as the player turns.
  const panelSpecs = [
    [-0.30, 0.84, 0.42, 1.18, -0.16], [0.30, 0.84, 0.42, 1.18, 0.16],
    [-0.18, 0.72, 0.30, 0.94, -0.08], [0.18, 0.72, 0.30, 0.94, 0.08],
  ]
  for (const [x, y, width, height, yaw] of panelSpecs) {
    const robePanel = panel(width, height, silk, 0.24)
    robePanel.position.set(x, y, 0.22)
    robePanel.rotation.y = yaw
    robePanel.castShadow = true
    root.add(robePanel)
    const seam = new THREE.Mesh(new THREE.TorusGeometry(width * 0.44, 0.012, 6, 28, Math.PI), trim)
    seam.rotation.set(Math.PI / 2, yaw, 0)
    seam.position.set(x, y - height * 0.37, 0.27)
    root.add(seam)
  }
  const sashPlate = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.20, 0.075, 3, 0.03), trim)
  sashPlate.position.set(0, 1.22, 0.37)
  sashPlate.rotation.z = 0.05
  root.add(sashPlate)
  const sashGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 2), bladeMat)
  sashGem.position.set(0, 1.20, 0.43)
  sashGem.scale.set(0.85, 1.25, 0.42)
  root.add(sashGem)
  for (const side of [-1, 1]) {
    const tassel = tube([
      [side * 0.22, 1.20, 0.36], [side * 0.25, 0.86, 0.34],
      [side * 0.30, 0.62, 0.30],
    ], 0.025, hairHighlight, 12, 6)
    root.add(tassel)
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), bladeMat)
    bead.position.set(side * 0.30, 0.59, 0.30)
    root.add(bead)
  }

  const heldSword = new THREE.Group()
  heldSword.name = 'held-frost-sword'
  heldSword.position.set(-0.50, 1.05, 0.30)
  heldSword.rotation.z = 0.52
  const heldBlade = blade(bladeMat, 1.36)
  heldBlade.position.y = 0.64
  heldSword.add(heldBlade)
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 12), trim)
  guard.rotation.z = Math.PI / 2
  guard.position.y = -0.03
  heldSword.add(guard)
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.20, 12), hair)
  grip.position.y = -0.14
  heldSword.add(grip)
  root.add(heldSword)

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.018, 8, 64), new THREE.MeshBasicMaterial({ color: pal.accent ?? 0x83e8ff, transparent: true, opacity: 0.72 }))
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.035
  root.add(ring)

  const orbit = []
  for (let i = 0; i < 3; i++) {
    const sword = blade(bladeMat)
    sword.visible = false
    root.add(sword)
    orbit.push(sword)
  }

  let time = 0
  let facing = 0
  let swordCount = 0
  return {
    root,
    height: 2.25,
    setExpression() {},
    setOrbitSwords(count) {
      swordCount = Math.max(0, Math.min(3, count))
      orbit.forEach((sword, i) => { sword.visible = i < swordCount })
    },
    update(dt, speed01, facingAngle) {
      time += dt
      let delta = facingAngle - facing
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      facing += delta * (1 - Math.exp(-14 * dt))
      // The authored mesh faces +Z, the camera-facing side of the standard
      // survivor rig. The input angle itself remains unchanged for movement and
      // weapon targeting.
      root.rotation.y = facing
      root.position.y = Math.abs(Math.sin(time * 9.0)) * 0.028 * speed01
      cloak.rotation.z = Math.sin(time * 2.2) * 0.025
      ring.rotation.z = time * 0.5
      for (let i = 0; i < swordCount; i++) {
        const a = time * 1.25 + i * (Math.PI * 2 / swordCount)
        orbit[i].position.set(Math.cos(a) * 0.78, 1.0 + Math.sin(a * 2) * 0.06, Math.sin(a) * 0.78)
        orbit[i].rotation.set(Math.PI * 0.92, -a, 0)
      }
    },
    dispose() {
      root.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) object.material.dispose()
      })
      root.removeFromParent()
    },
  }
}

export function buildJadeTitan() {
  const root = new THREE.Group()
  root.name = 'heroic-jade-titan'
  const armor = standard(0x344d61, { roughness: 0.40, metalness: 0.46, clearcoat: 0.28 })
  const plate = standard(0x7e9da3, { roughness: 0.40, metalness: 0.36 })
  const jadeWeave = weaveTexture('materials/guardians/jade-scale-weave-v1.png', [2.4, 1.8])
  const jade = standard(0x238b78, { roughness: 0.32, metalness: 0.14, emissive: 0x075f52, emissiveIntensity: 0.10, clearcoat: 0.24, map: jadeWeave })
  const horn = standard(0xb7d8d7, { roughness: 0.3, metalness: 0.18, emissive: 0x255b62, emissiveIntensity: 0.12 })
  const eye = standard(0xc6fff4, { roughness: 0.12, emissive: 0x39ffe2, emissiveIntensity: 0.9 })

  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 0.54, 10, 24), armor)
  pelvis.position.y = 0.70
  pelvis.scale.z = 0.72
  root.add(pelvis)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.76, 0.94, 12, 28), armor)
  torso.position.y = 1.55
  torso.scale.set(1.05, 1.08, 0.72)
  root.add(torso)
  const chest = new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.62, 0.24, 3, 0.08), plate)
  chest.position.set(0, 1.64, 0.48)
  chest.rotation.x = -0.06
  root.add(chest)
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.055, 8, 32), jade)
  belt.rotation.x = Math.PI / 2
  belt.position.y = 1.12
  belt.scale.z = 0.72
  root.add(belt)
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 2), jade)
  crystal.position.set(0, 1.67, 0.72)
  crystal.rotation.z = Math.PI / 4
  root.add(crystal)

  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.62, 8, 18), armor)
    thigh.position.set(side * 0.35, 0.38, 0)
    thigh.rotation.z = side * 0.05
    root.add(thigh)
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), plate)
    shoulder.position.set(side * 0.83, 1.92, 0)
    shoulder.scale.set(1.18, 0.62, 0.86)
    root.add(shoulder)
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.78, 8, 18), armor)
    arm.position.set(side * 0.98, 1.28, 0.02)
    arm.rotation.z = side * 0.18
    root.add(arm)
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), plate)
    fist.position.set(side * 1.06, 0.78, 0.10)
    fist.scale.z = 0.8
    root.add(fist)
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.49, 28, 22), armor)
  head.position.set(0, 2.72, 0.10)
  head.scale.set(1.02, 1.05, 0.92)
  root.add(head)
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 18), plate)
  face.position.set(0, 2.63, 0.43)
  face.scale.set(1.0, 0.72, 0.34)
  root.add(face)
  addEyePair(root, eye, 2.72, 0.73, 0.17, 0.07)
  for (const side of [-1, 1]) {
    root.add(tube([
      [side * 0.20, 2.96, 0.04], [side * 0.45, 3.18, -0.02], [side * 0.62, 3.40, -0.20],
    ], 0.12, horn, 16, 12))
  }
  for (let i = -2; i <= 2; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.58, 12), horn)
    spike.position.set(i * 0.25, 2.97 + Math.abs(i) * 0.08, -0.16)
    spike.rotation.x = -0.50
    root.add(spike)
  }

  const hammer = new THREE.Group()
  hammer.position.set(-1.32, 0.92, 0.34)
  hammer.rotation.z = -0.28
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 2.35, 18), armor)
  shaft.position.y = 0.55
  hammer.add(shaft)
  const headMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.54, 8, 18), plate)
  headMesh.rotation.z = Math.PI / 2
  headMesh.position.y = 1.70
  hammer.add(headMesh)
  const hammerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 1), jade)
  hammerCore.position.set(0, 1.70, 0.30)
  hammer.add(hammerCore)
  root.add(hammer)
  return root
}

export function buildJadeDragon() {
  const root = new THREE.Group()
  root.name = 'heroic-jade-dragon'
  const scaleWeave = weaveTexture('materials/guardians/jade-scale-weave-v1.png', [3.2, 2.0])
  const scaleMat = standard(0x3b938d, { roughness: 0.34, metalness: 0.14, emissive: 0x075f65, emissiveIntensity: 0.07, clearcoat: 0.36, map: scaleWeave })
  const bellyMat = standard(0xa9ded1, { roughness: 0.36, metalness: 0.06, clearcoat: 0.3 })
  const hornMat = standard(0xc4e9e2, { roughness: 0.27, metalness: 0.16 })
  const eyeMat = standard(0xcaffc7, { roughness: 0.10, emissive: 0x8dffbd, emissiveIntensity: 0.85 })
  const path = [
    [-1.10, 0.14, -0.42], [-0.60, 0.10, -0.95], [0.18, 0.12, -1.04],
    [0.86, 0.17, -0.64], [1.04, 0.24, 0.10], [0.72, 0.42, 0.60],
    [0.36, 0.85, 0.54], [0.42, 1.28, 0.30], [0.58, 1.65, 0.35],
  ]
  root.add(tube(path, 0.22, scaleMat, 36, 20))
  for (let i = 0; i < path.length - 1; i++) {
    const [x, y, z] = path[i]
    const scute = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), bellyMat)
    scute.position.set(x, y - 0.10, z + 0.12)
    scute.scale.set(0.62, 0.16, 0.78)
    scute.rotation.y = -i * 0.28
    root.add(scute)
  }
  const neck = path[path.length - 1]
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 32, 24), scaleMat)
  head.position.set(neck[0], neck[1] + 0.24, neck[2] + 0.12)
  head.scale.set(0.82, 0.72, 1.28)
  root.add(head)
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), bellyMat)
  muzzle.position.set(neck[0], neck[1] + 0.18, neck[2] + 0.49)
  muzzle.scale.set(0.78, 0.55, 1.15)
  root.add(muzzle)
  addEyePair(root, eyeMat, neck[1] + 0.37, neck[2] + 0.43, 0.16, 0.045)
  const brow = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 6, 24, Math.PI), hornMat)
  brow.position.set(neck[0], neck[1] + 0.48, neck[2] + 0.41)
  brow.rotation.set(Math.PI / 2, 0, Math.PI / 2)
  root.add(brow)
  for (const side of [-1, 1]) {
    root.add(tube([
      [neck[0] + side * 0.17, neck[1] + 0.55, neck[2] + 0.06],
      [neck[0] + side * 0.34, neck[1] + 0.84, neck[2] - 0.04],
      [neck[0] + side * 0.28, neck[1] + 1.05, neck[2] - 0.18],
    ], 0.075, hornMat, 16, 10))
    root.add(tube([
      [neck[0] + side * 0.20, neck[1] + 0.15, neck[2] + 0.52],
      [neck[0] + side * 0.58, neck[1] + 0.08, neck[2] + 0.70],
      [neck[0] + side * 0.86, neck[1] + 0.03, neck[2] + 0.62],
    ], 0.018, hornMat, 14, 8))
  }
  for (let i = 0; i < 8; i++) {
    const t = i / 7
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06 + (1 - t) * 0.05, 0.32 + (1 - t) * 0.20, 6), hornMat)
    fin.position.set(path[Math.min(path.length - 1, i + 1)][0], path[Math.min(path.length - 1, i + 1)][1] + 0.24, path[Math.min(path.length - 1, i + 1)][2] - 0.12)
    fin.rotation.z = -0.5 + t * 0.25
    root.add(fin)
  }
  return root
}

function feather(material, length, width) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.quadraticCurveTo(width, length * 0.35, width * 0.12, length)
  shape.quadraticCurveTo(-width * 0.24, length * 0.68, 0, 0)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: true, bevelSegments: 2, bevelThickness: 0.018, bevelSize: 0.018 })
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  return mesh
}

export function buildEmberPhoenix() {
  const root = new THREE.Group()
  root.name = 'heroic-ember-phoenix'
  const emberWeave = weaveTexture('materials/guardians/ember-feather-weave-v1.png', [2.4, 1.8])
  const ember = standard(0xc95732, { roughness: 0.38, metalness: 0.10, emissive: 0xd02b10, emissiveIntensity: 0.12, clearcoat: 0.24, map: emberWeave })
  const gold = standard(0xffab4c, { roughness: 0.32, metalness: 0.18, emissive: 0xff5520, emissiveIntensity: 0.18, clearcoat: 0.30, map: emberWeave })
  const dark = standard(0x5a2030, { roughness: 0.36, metalness: 0.14, emissive: 0x861d22, emissiveIntensity: 0.15 })
  const eye = standard(0xffe5a2, { roughness: 0.08, emissive: 0xff6b20, emissiveIntensity: 1.7 })
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.82, 10, 24), ember)
  body.position.y = 1.72
  body.rotation.x = -0.10
  root.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 18), gold)
  head.position.set(0, 2.24, 0.32)
  head.scale.z = 1.2
  root.add(head)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 12), gold)
  beak.rotation.x = Math.PI / 2
  beak.position.set(0, 2.20, 0.68)
  root.add(beak)
  addEyePair(root, eye, 2.30, 0.59, 0.12, 0.038)
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const f = feather(i % 2 ? gold : ember, 1.05 + i * 0.18, 0.28 - i * 0.018)
      f.position.set(side * (0.15 + i * 0.05), 1.96 + i * 0.07, -0.04 - i * 0.07)
      f.rotation.set(0.18 + i * 0.04, side * 0.16, side * (0.52 + i * 0.09))
      root.add(f)
    }
  }
  for (let i = 0; i < 5; i++) {
    const f = feather(i % 2 ? dark : gold, 0.85 + i * 0.18, 0.22)
    f.position.set((i - 2) * 0.10, 1.56 - i * 0.05, -0.55 - i * 0.12)
    f.rotation.x = -0.55
    f.rotation.z = (i - 2) * 0.12
    root.add(f)
  }
  root.add(tube([[0, 2.38, 0.0], [0, 2.78, -0.08], [0, 3.08, -0.26]], 0.055, gold, 16, 10))
  return root
}

export function buildVoidSage() {
  const root = new THREE.Group()
  const robe = standard(0x46305f, { roughness: 0.50, metalness: 0.20, emissive: 0x24103b, emissiveIntensity: 0.16 })
  const trim = standard(0xe5bb63, { roughness: 0.28, metalness: 0.58, emissive: 0x9e5a20, emissiveIntensity: 0.22 })
  const mask = standard(0xe8e0ff, { roughness: 0.24, metalness: 0.12 })
  const gown = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.44, 0.06), new THREE.Vector2(0.62, 0.55),
    new THREE.Vector2(0.42, 1.45), new THREE.Vector2(0.30, 2.0), new THREE.Vector2(0.0, 2.12),
  ], 32), robe)
  gown.position.y = 0.02
  root.add(gown)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 18), mask)
  head.position.set(0, 2.45, 0.10)
  root.add(head)
  for (const side of [-1, 1]) {
    root.add(tube([[side * 0.18, 2.48, 0.04], [side * 0.48, 2.78, -0.10], [side * 0.64, 2.98, -0.38]], 0.055, trim, 14, 9))
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.035, 8, 48), trim)
  halo.position.set(0, 2.50, -0.28)
  halo.rotation.x = 0.18
  root.add(halo)
  return root
}

export function adoptModel(root, geometries, materials) {
  root.traverse((object) => {
    if (!object.isMesh) return
    if (object.geometry) geometries.push(object.geometry)
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.push(material)
    }
    object.castShadow = true
    object.receiveShadow = true
  })
  return root
}
