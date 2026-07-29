import * as THREE from 'three'
import { makeToonMaterial, makeAdditiveMaterial, makeFlatMaterial, makeOutlineMaterial } from './materials.js'
import { baguaTexture } from './textures.js'
import { buildMerged } from './geometry.js'
import { buildColored, gradient, limb, revolve } from './shapeKit.js'
import { panelSeams, studRing, tassel, trimBand } from './detailKit.js'
import { faceSet } from './faces.js'

/** Lighten or darken a hex colour by a factor, for cheap tonal variants. */
function shade(hex, factor) {
  const c = new THREE.Color(hex)
  c.r = Math.min(1, c.r * factor)
  c.g = Math.min(1, c.g * factor)
  c.b = Math.min(1, c.b * factor)
  return c.getHex()
}

/**
 * Builds a chibi cultivator from Three.js primitives — no external models.
 *
 * Proportions are deliberately chibi (head roughly a third of total height): at
 * gameplay camera distance that is what keeps the character reading as a person
 * rather than a coloured smudge.
 */

const HEIGHT = 1.9
const _v = new THREE.Vector3()

function swayShader(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uSway = uniforms.uSway
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uSway;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         // Hem swings, waist does not: weight the offset by how far down the skirt
         // the vertex sits.
         float hem = clamp( ( 0.30 - transformed.y ) / 0.55, 0.0, 1.0 );
         float ang = atan( transformed.x, transformed.z );
         transformed.x += sin( uTime * 6.0 + ang * 3.0 ) * uSway * hem;
         transformed.z += cos( uTime * 5.3 + ang * 3.0 ) * uSway * hem;`,
      )
  }
  material.customProgramCacheKey = () => 'toonRimSway'
}

/**
 * A forward-facing patch of sphere for the face, with its UVs rescaled to span
 * 0..1 so the face texture fills exactly this patch.
 *
 * three's sphere puts +Z at phi = π/2, so the patch is centred there.
 */
function faceShellGeometry(radius) {
  // Seated high on the sphere and angled upward, so the face still catches a
  // camera looking down from 52°.
  const phiLength = 1.66
  const thetaStart = 0.50
  const thetaLength = 1.30
  const geo = new THREE.SphereGeometry(
    radius, 20, 16,
    Math.PI / 2 - phiLength / 2, phiLength,
    thetaStart, thetaLength,
  )
  const uv = geo.attributes.uv
  // The patch inherits a sub-rectangle of the full sphere's UV range; stretch it
  // back out to the full texture.
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
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

function hairProfile() {
  // Lathe silhouette for the back hair mass: a rounded bell that flares out.
  const pts = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const y = 0.34 - t * 0.86
    const r = 0.30 + Math.sin(t * Math.PI * 0.92) * 0.20 + t * 0.06
    pts.push(new THREE.Vector2(r, y))
  }
  return pts
}

export function buildChibi(character) {
  const pal = character.palette
  const root = new THREE.Group()

  const uniforms = {
    uTime: { value: 0 },
    uSway: { value: 0.06 },
  }

  const skinMat = makeToonMaterial({ color: pal.skin, rim: 0.3, rimColor: 0xffe9de })
  const hairMat = makeToonMaterial({ color: pal.hair, rim: 0.55, rimColor: pal.accent })
  const clothMat = makeToonMaterial({ color: pal.cloth, rim: 0.4, rimColor: pal.accent })
  const trimMat = makeToonMaterial({ color: pal.trim, rim: 0.45, rimColor: pal.accent })
  const skirtMat = makeToonMaterial({
    color: 0xffffff, rim: 0.22, rimColor: pal.accent,
    side: THREE.DoubleSide, vertexColors: true,
  })
  swayShader(skirtMat, uniforms)
  // Vertex-coloured variants so hair and cloth can carry a root-to-tip gradient
  // instead of being one flat tone.
  const hairVertexMat = makeToonMaterial({ color: 0xffffff, rim: 0.3, rimColor: pal.accent, vertexColors: true })
  const clothVertexMat = makeToonMaterial({ color: 0xffffff, rim: 0.22, rimColor: pal.accent, vertexColors: true })

  // ---- Head ----------------------------------------------------------------
  // Everything head-related hangs off one pivot so hair, fringe, ears and face
  // always turn together. Rotating them separately misaligns the hair's open
  // front with the face and buries the expression.
  const headPivot = new THREE.Group()
  headPivot.position.y = 1.36
  root.add(headPivot)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), skinMat)
  head.scale.set(1, 0.94, 0.95)
  head.castShadow = true
  headPivot.add(head)

  // The face is a curved shell hugging the head, not a flat plane: a plane large
  // enough to hold the face sinks inside the sphere and the head occludes it.
  // Parented to the head so it inherits the same squash and turns with it.
  const faces = faceSet(pal)
  const faceMat = makeFlatMaterial({ map: faces.idle })
  faceMat.transparent = true
  faceMat.depthWrite = false
  const face = new THREE.Mesh(faceShellGeometry(0.428), faceMat)
  face.renderOrder = 2
  head.add(face)

  // ---- Hair ----------------------------------------------------------------
  // Partial revolution, open at the front: a full lathe wraps the face as well as
  // the back of the head and buries the whole expression.
  const hairBack = new THREE.Mesh(
    new THREE.LatheGeometry(hairProfile(), 20, 0.62, Math.PI * 2 - 1.24),
    hairMat,
  )
  hairBack.material.side = THREE.DoubleSide
  hairBack.castShadow = true
  headPivot.add(hairBack)

  // Fringe: a shallow cap that sits over the brow.
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat)
  fringe.position.y = 0.04
  fringe.scale.set(1.02, 1.05, 1.02)
  headPivot.add(fringe)

  // Anime hair highlight — a bright band wrapping the crown. Without it the hair
  // is one flat mass however many strands are attached to it.
  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.455, 24, 10, 0, Math.PI * 2, Math.PI * 0.22, Math.PI * 0.1),
    makeFlatMaterial({ color: 0xffffff, opacity: 0.34 }),
  )
  highlight.position.y = 0.04
  highlight.scale.set(1.02, 1.05, 1.02)
  highlight.renderOrder = 1
  headPivot.add(highlight)

  const strands = []
  const addStrand = (x, y, z, len, rz, radius = 0.09) => {
    // A tapered tube hanging from its attachment point, not a capsule centred on
    // its middle: the taper reads as hair and the pivot lands where the strand
    // actually meets the head, so the sway swings from the root.
    const geo = limb(
      [[0, 0, 0], [0, -len * 0.45, len * 0.06], [0, -len * 0.82, len * 0.02], [0, -len * 1.05, -len * 0.08]],
      [1.0, 1.12, 0.78, 0.18], 12, 7,
    )
    // limb() builds at a base radius of 1 and its `radii` are multipliers, so the
    // cross-section has to be scaled to the real thickness here.
    geo.scale(radius, 1, radius)
    gradient(geo, pal.hair, shade(pal.hair, 1.28), 'y')
    const m = new THREE.Mesh(geo, hairVertexMat)
    m.position.set(x, y - 1.36, z)
    m.rotation.z = rz
    m.castShadow = true
    headPivot.add(m)
    strands.push({ mesh: m, baseZ: rz, phase: strands.length * 1.7 })
    return m
  }

  if (character.id === 'seolryeong') {
    // Long twintails.
    addStrand(-0.44, 1.02, -0.05, 0.72, 0.22, 0.10)
    addStrand(0.44, 1.02, -0.05, 0.72, -0.22, 0.10)
  } else if (character.id === 'hongryeon') {
    // Side locks framing the face, plus a long tail down the back.
    addStrand(-0.40, 1.10, 0.10, 0.46, 0.12, 0.08)
    addStrand(0.40, 1.10, 0.10, 0.46, -0.12, 0.08)
    addStrand(0, 0.98, -0.34, 0.80, 0, 0.13)
  } else {
    // Short bob — just two short flicks.
    addStrand(-0.40, 1.16, -0.02, 0.24, 0.5, 0.09)
    addStrand(0.40, 1.16, -0.02, 0.24, -0.5, 0.09)
  }

  // 청묘: 요족 cat ears and tail.
  if (character.id === 'cheongmyo') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 5), hairMat)
      ear.position.set(side * 0.22, 0.36, -0.02)
      ear.rotation.z = side * 0.28
      headPivot.add(ear)
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 5), trimMat)
      inner.position.set(side * 0.22, 0.35, 0.03)
      inner.rotation.z = side * 0.28
      headPivot.add(inner)
    }
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.62, -0.18),
      new THREE.Vector3(0.06, 0.80, -0.44),
      new THREE.Vector3(-0.04, 1.02, -0.60),
      new THREE.Vector3(-0.16, 1.16, -0.46),
    ])
    const tail = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.07, 6, false), hairMat)
    tail.castShadow = true
    root.add(tail)
  }

  // ---- Body ----------------------------------------------------------------
  // Shoulders, a pinched waist and a collar, instead of a plain capsule.
  const torsoGeo = revolve([
    [0.00, 0.26], [0.15, 0.25], [0.235, 0.19], [0.245, 0.06],
    [0.215, -0.06], [0.205, -0.16], [0.23, -0.24], [0.00, -0.26],
  ], 20)
  gradient(torsoGeo, shade(pal.cloth, 0.68), shade(pal.cloth, 1.12), 'y')
  const torso = new THREE.Mesh(torsoGeo, clothVertexMat)
  torso.position.y = 0.86
  torso.castShadow = true
  root.add(torso)

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.20, 0.10, 12), trimMat)
  collar.position.y = 1.08
  root.add(collar)

  // Sleeves widen toward the wrist, 한푸 style, then a bare hand.
  const arms = []
  for (const side of [-1, 1]) {
    const sleeve = limb(
      [[0, 0.18, 0], [0, 0.02, 0.01], [0, -0.14, 0.0], [0, -0.2, -0.01]],
      [0.72, 0.9, 1.05, 0.86], 10, 8,
    )
    sleeve.scale(0.115, 1, 0.115)
    gradient(sleeve, shade(pal.cloth, 1.1), shade(pal.cloth, 0.72), 'y')
    const arm = new THREE.Mesh(sleeve, clothVertexMat)
    arm.position.set(side * 0.29, 0.84, 0)
    arm.castShadow = true
    root.add(arm)
    arms.push(arm)

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 8), skinMat)
    hand.scale.set(1, 1.15, 0.9)
    hand.position.set(side * 0.29, 0.62, 0)
    root.add(hand)
    arms.push(hand)
  }

  const legs = []
  for (const side of [-1, 1]) {
    const shin = limb(
      [[0, 0.13, 0], [0, 0.02, 0], [0, -0.1, 0]],
      [0.92, 0.8, 0.78], 8, 7,
    )
    shin.scale(0.09, 1, 0.09)
    const leg = new THREE.Mesh(shin, skinMat)
    leg.position.set(side * 0.11, 0.24, 0)
    root.add(leg)
    legs.push(leg)

    // Slipper: rounded toe rather than a box.
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), trimMat)
    shoe.scale.set(0.82, 0.55, 1.25)
    shoe.position.set(side * 0.11, 0.055, 0.035)
    root.add(shoe)
    legs.push(shoe)
  }

  // ---- Skirt ---------------------------------------------------------------
  // A flared robe turned on a lathe, not a plain cone: the hem kicks out and the
  // waist pinches, which is what makes it read as cloth rather than a funnel.
  const skirtGeo = revolve([
    [0.18, 0.30], [0.23, 0.19], [0.28, 0.04], [0.34, -0.10],
    [0.40, -0.20], [0.44, -0.245], [0.41, -0.26],
  ], 24)
  gradient(skirtGeo, shade(pal.cloth, 0.66), pal.cloth, 'y')

  // Detail merged into the skirt itself rather than parented alongside it, so
  // the trim and seams sway with the cloth instead of hanging in the air.
  const skirtProfile = [
    [0.18, 0.30], [0.23, 0.19], [0.28, 0.04], [0.34, -0.10],
    [0.40, -0.20], [0.44, -0.245],
  ]
  const detailed = buildColored([
    [skirtGeo, {}, undefined],
    trimBand(0.445, -0.235, 0.055, pal.trim, { taper: 0.94, segments: 24 }),
    ...panelSeams(6, skirtProfile, shade(pal.trim, 0.8), { thickness: 0.009, lift: 1.02 }),
  ])
  const skirt = new THREE.Mesh(detailed, skirtMat)
  skirt.position.y = 0.52
  skirt.castShadow = true
  root.add(skirt)

  // Waist hardware and hanging tassels — static, so parented to the body.
  const beltGeo = buildColored([
    ...studRing(8, 0.255, 0.70, pal.accent, { size: 0.028, shape: 'gem' }),
    ...tassel(0.16, 0.66, 0.20, 0.22, pal.trim, pal.accent),
    ...tassel(-0.16, 0.66, 0.20, 0.17, pal.trim, pal.accent),
  ])
  root.add(new THREE.Mesh(beltGeo, clothVertexMat))

  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.255, 0.10, 14), trimMat)
  sash.position.y = 0.70
  root.add(sash)

  // ---- Ribbons -------------------------------------------------------------
  // Cloth, not glow: an additive ribbon reads as a fluorescent bar floating beside
  // the head rather than as fabric.
  const ribbonMat = makeToonMaterial({ color: pal.trim, rim: 0.5, rimColor: pal.accent, side: THREE.DoubleSide })
  const ribbons = []
  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.38), ribbonMat)
    r.position.set(side * 0.20, -0.02, -0.40)
    r.rotation.set(0.35, side * 0.3, side * 0.5)
    headPivot.add(r)
    ribbons.push({ mesh: r, phase: side })
  }
  // Bow knot holding them.
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), ribbonMat)
  knot.position.set(0, 0.14, -0.34)
  headPivot.add(knot)

  // ---- 팔괘 formation ring at the feet -------------------------------------
  const ring = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    makeAdditiveMaterial({ color: pal.accent, opacity: 0.55, map: baguaTexture() }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.03
  root.add(ring)

  // ---- Orbiting 비검 (cosmetic) --------------------------------------------
  const swordMat = makeToonMaterial({ color: 0xdbe7f2, rim: 0.8, rimColor: pal.accent })
  const swordGeo = buildMerged([
    // Blade, tapered to a point.
    [new THREE.BoxGeometry(0.055, 0.42, 0.016), { y: 0.16 }],
    [new THREE.ConeGeometry(0.032, 0.12, 4), { y: 0.43 }],
    // Crossguard and grip.
    [new THREE.BoxGeometry(0.15, 0.03, 0.03), { y: -0.06 }],
    [new THREE.CylinderGeometry(0.022, 0.022, 0.13, 6), { y: -0.13 }],
    [new THREE.SphereGeometry(0.032, 6, 5), { y: -0.21 }],
  ])
  const swords = []
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(swordGeo, swordMat)
    s.visible = false
    s.castShadow = true
    root.add(s)
    swords.push(s)
  }
  let swordCount = 0

  // Only the character casts shadows; receiving them on a low-poly figure this
  // small just produces acne.
  root.traverse((o) => { if (o.isMesh) o.receiveShadow = false })

  // Cel outlines on the silhouette masses only. Shelling all ~30 child meshes
  // would double the player's draw calls for detail invisible at gameplay
  // distance; the head, hair, torso and skirt carry the read.
  const outlineMat = makeOutlineMaterial(0.024)
  for (const source of [head, hairBack, fringe, torso, skirt]) {
    const shell = new THREE.Mesh(source.geometry, outlineMat)
    shell.position.copy(source.position)
    shell.rotation.copy(source.rotation)
    shell.scale.copy(source.scale)
    shell.renderOrder = -1
    source.parent.add(shell)
  }

  let time = 0
  let facing = 0
  let expressionTimer = 0

  return {
    root,
    height: HEIGHT,

    setExpression(name, holdSeconds = 0) {
      faceMat.map = faces[name] ?? faces.idle
      faceMat.needsUpdate = true
      expressionTimer = holdSeconds
    },

    setOrbitSwords(count) {
      swordCount = Math.max(0, Math.min(3, count))
      for (let i = 0; i < 3; i++) swords[i].visible = i < swordCount
    },

    update(dt, speed01, facingAngle) {
      time += dt
      uniforms.uTime.value = time
      uniforms.uSway.value = 0.06 + speed01 * 0.10

      if (expressionTimer > 0) {
        expressionTimer -= dt
        if (expressionTimer <= 0) {
          faceMat.map = faces.idle
          faceMat.needsUpdate = true
        }
      }

      // Damped turn, framerate-independent.
      let delta = facingAngle - facing
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      facing += delta * (1 - Math.exp(-14 * dt))
      root.rotation.y = facing
      // The head turns only a third as far as the body. Without this, running
      // away from the camera shows the back of her head and the face — the whole
      // point of the character — is never seen.
      headPivot.rotation.y = -facing * 0.66

      // Bob and limb swing scale with speed, so standing still is truly still.
      const stride = Math.sin(time * 11)
      root.position.y = Math.abs(stride) * 0.035 * speed01
      for (let i = 0; i < arms.length; i += 2) {
        const dir = i === 0 ? 1 : -1
        arms[i].rotation.x = stride * 0.5 * speed01 * dir
        arms[i + 1].position.z = stride * 0.16 * speed01 * dir
      }
      for (let i = 0; i < legs.length; i += 2) {
        const dir = i === 0 ? -1 : 1
        legs[i].position.z = stride * 0.10 * speed01 * dir
        legs[i + 1].position.z = 0.03 + stride * 0.13 * speed01 * dir
      }

      for (const s of strands) {
        s.mesh.rotation.z = s.baseZ + Math.sin(time * 5 + s.phase) * (0.05 + speed01 * 0.14)
        s.mesh.rotation.x = -speed01 * 0.30
      }
      for (const r of ribbons) {
        r.mesh.rotation.z = r.phase * 0.4 + Math.sin(time * 4 + r.phase) * 0.25
      }

      ring.rotation.z = time * 0.4
      ring.material.opacity = 0.42 + Math.sin(time * 2) * 0.10

      // Swords hang point-down and circle the cultivator, 어검술 style.
      for (let i = 0; i < swordCount; i++) {
        const a = time * 1.4 + (i / swordCount) * Math.PI * 2
        _v.set(Math.cos(a) * 0.82, 0.95 + Math.sin(a * 2 + time) * 0.10, Math.sin(a) * 0.82)
        swords[i].position.copy(_v)
        swords[i].rotation.set(Math.PI * 0.92, -a + Math.PI / 2, 0)
      }
    },

    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) o.material.dispose()
      })
      root.removeFromParent()
    },
  }
}
