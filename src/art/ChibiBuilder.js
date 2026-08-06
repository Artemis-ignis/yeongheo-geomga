import * as THREE from 'three'
import { makeToonMaterial, makeAdditiveMaterial, makeFlatMaterial, makeOutlineMaterial } from './materials.js'
import { baguaTexture } from './textures.js'
import { buildMerged } from './geometry.js'
import { buildColored, gradient, limb, revolve } from './shapeKit.js'
import { panelSeams, studRing, tassel, trimBand } from './detailKit.js'
import { faceSet } from './faces.js'
import { buildImg2ThreeSeolryeong } from './SeolryeongImg2ThreeAdapter.js'

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
  // Spans the whole front of the head, brow to chin.
  //
  // This used to stop at theta 1.80 — barely past the equator — so the entire
  // lower 40% of the head was bare skin with no texture on it, and the features
  // were squashed into the band above. It rendered as a face painted on the top
  // of an egg. A chibi head is mostly face; the patch has to cover mostly head.
  const phiLength = 1.92
  const thetaStart = 0.62
  const thetaLength = 1.86
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
  // Back hair, kept inside the head's own width.
  //
  // This used to bell out to a radius of 0.56 — wider than the 0.42 head and
  // hanging past the shoulders — so the widest part of her whole silhouette was
  // a curtain of hair at chest height. Head and hair and torso then merged into
  // one continuous oval, which is why she read as an egg at play distance no
  // matter how good the face was. It now tucks in behind the shoulders and lets
  // the body define the outline.
  const pts = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const y = 0.34 - t * 0.74
    const r = 0.29 + Math.sin(t * Math.PI * 0.9) * 0.10 - t * 0.07
    pts.push(new THREE.Vector2(Math.max(0.05, r), y))
  }
  return pts
}

/**
 * One lock of hair: a flattened, tapered blade that hugs the skull at the root
 * and comes to a point at the tip.
 *
 * `wide` is the tangential width and `thick` the radial thickness, and the two
 * are deliberately different — a lock with a round cross-section is a spike, and
 * a head ringed with spikes is a pineapple. Hair is made of ribbons.
 *
 * `sweep` bends the lock sideways as it descends, which is the whole difference
 * between bangs that were cut with a ruler and bangs that were styled.
 */
function hairLock({ len, wide, thick, sweep = 0, curl = 0, root, tip }) {
  // The real radius goes through `radii`, not through a post-hoc scale.
  //
  // `limb` builds a radius-1 tube and its `radii` rescale each ring, so the
  // usual `geo.scale(w, 1, t)` afterwards only squeezes X and Z — the tube keeps
  // a full 1.0-unit bulge along Y wherever the curve is not vertical. Every lock
  // was a metre-long spike hidden inside a thin ribbon, which is what turned the
  // fringe into a spiked fan standing above her head. Sizing the rings up front
  // is correct in all three axes; the scale below only sets the aspect.
  const geo = limb(
    [
      [0, 0, 0],
      [sweep * 0.25, -len * 0.36, curl * 0.3],
      [sweep * 0.7, -len * 0.72, curl * 0.75],
      [sweep, -len, curl],
    ],
    [wide, wide * 0.92, wide * 0.62, wide * 0.05], 10, 7,
  )
  geo.scale(1, 1, thick / wide)
  // Tinted here rather than by the caller. Skipping this once left every lock
  // painted the default white by buildColored, which under the warm key light
  // came out a flat pale beige — the exact tone that got the whole model called
  // a rice ball. An untinted lock is not a subtle bug; it is the whole problem.
  gradient(geo, tip, root, 'y')
  return geo
}

/**
 * The hair, as one merged geometry instead of three dozen separate meshes.
 *
 * The previous crown was sixteen cones splayed almost horizontally around the
 * skull plus twenty more ringing the hairline. From the play camera — which
 * looks down at 52°, so the crown is most of what you see — that read as a
 * jagged pale ring around a rounded lump, which is to say it read as a rice
 * ball. That is not a figure of speech; it is what it was called, four times.
 *
 * What anime hair actually is at this scale is a small number of broad,
 * pointed, *asymmetric* shapes. Seven bangs of varying length beat thirty-six
 * uniform spikes, and merging them takes one character's head from ~38 draw
 * calls to 1.
 */
/** Where the hairline sits, as a function of azimuth (0 = straight ahead). */
const HAIRLINE_FRONT = 0.255
const HAIRLINE_SIDE = -0.055
const HAIRLINE_BACK = -0.20

/**
 * The crown, as a dome whose lower rim rides high over the brow and sweeps down
 * past the ears to cover the back of the skull.
 *
 * A dome with a *level* rim is the thing that kept reading as a hat, and three
 * previous attempts tried to fix that by decorating the rim instead of moving
 * it. Real hair has no level rim anywhere: it is high at the forehead and low
 * everywhere else, and that single asymmetry is what makes it hair.
 *
 * Built by taking a hemisphere and remapping each vertex's height so the
 * hemisphere's equator lands on the target hairline for its own azimuth.
 */
function crownShell(radius) {
  const geo = new THREE.SphereGeometry(radius, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5)
  const pos = geo.attributes.position
  const top = radius
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    // 1 straight ahead, 0 at the back.
    const front = (Math.cos(Math.atan2(x, z)) + 1) * 0.5
    const rim = front > 0.5
      ? HAIRLINE_SIDE + (HAIRLINE_FRONT - HAIRLINE_SIDE) * ((front - 0.5) * 2) ** 1.6
      : HAIRLINE_BACK + (HAIRLINE_SIDE - HAIRLINE_BACK) * (front * 2)
    pos.setY(i, rim + (y / top) * (top - rim))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

function buildHair(pal, style) {
  const parts = []
  const root = pal.hairRoot ?? shade(pal.hair, 0.55)
  const tip = pal.hair

  // Grown a little proud of the 0.42 skull so it reads as hair with volume
  // rather than as paint on the scalp.
  const crown = crownShell(0.44)
  crown.scale(0.98, 1, 1.0)
  crown.translate(0, 0, -0.015)
  gradient(crown, root, tip, 'y')
  parts.push([crown, {}])

  // Bangs, hanging from the front rim to just above the brow. Lengths follow a
  // low-frequency wave rather than a constant, and the wave is offset so the two
  // halves do not mirror — a symmetric fringe is the most doll-like thing a face
  // can wear. They sit slightly proud of the face shell so they overlap it.
  const BANGS = 7
  for (let i = 0; i < BANGS; i++) {
    const t = i / (BANGS - 1)
    // ±52°, not ±72°. Wider than this and the outermost bangs stop sitting on
    // the forehead and start sticking out past the temples, which turns the
    // whole upper silhouette into a spiked fan.
    const a = (t - 0.5) * 1.82
    // Short in the middle, long at the temples: a fringe that parts and opens
    // the face, rather than one that hangs a lock down between the eyes. The
    // previous wave peaked at centre and put a dark bar across the bridge of her
    // nose that read as a scowl. The `t*0.06` skews the parting off-centre so
    // the two halves are not mirrors.
    const len = 0.105 + Math.abs(t - 0.5) * 0.30 + t * 0.06
    const geo = hairLock({
      len,
      wide: 0.085 + Math.abs(0.5 - t) * 0.03,
      thick: 0.036,
      // Everything sweeps the same way, so the fringe has a parting and a
      // direction instead of falling open down the middle.
      sweep: 0.05 - t * 0.09,
      root, tip,
    })
    parts.push([geo, {
      ry: a,
      x: Math.sin(a) * 0.40,
      y: HAIRLINE_FRONT + 0.04,
      z: Math.cos(a) * 0.40,
    }])
  }

  // Side locks down past the jaw. Framing the face is most of what separates a
  // character from a bald sphere with eyes drawn on it — but they frame it only
  // if they stay beside it. At 0.062 wide and hung from the temples they were
  // two curtains falling to the waist, wider than her head and reading as ears.
  for (const side of [-1, 1]) {
    const geo = hairLock({
      len: style.sideLock ?? 0.34,
      wide: 0.042, thick: 0.055,
      sweep: side * 0.03,
      root, tip,
    })
    parts.push([geo, { ry: side * 1.5, x: side * 0.345, y: 0.06, z: 0.09 }])
  }

  // Ahoge — the one strand that will not lie down. A stock chibi cue, and unlike
  // everything else on the head it stands clear of the silhouette, so it
  // survives being viewed from above at a hundred pixels tall.
  if (style.ahoge !== false) {
    const a = limb(
      [[0, 0, 0], [0.01, 0.09, -0.03], [0.06, 0.15, -0.09], [0.13, 0.14, -0.12]],
      [0.024, 0.017, 0.010, 0.0015], 12, 6,
    )
    gradient(a, tip, tip, 'y')
    parts.push([a, { y: 0.40, z: -0.03 }])
  }

  return buildColored(parts)
}

/**
 * What makes each cultivator a different shape, as opposed to a different
 * palette.
 *
 * Put all six on the model sheet together and the problem was immediate: they
 * differed by hair colour and cloth colour and by nothing else, so at play
 * distance — where the palette is three or four pixels wide — the roster was
 * one character recoloured six times. Silhouette is the only channel that
 * survives that distance, so each gets a skirt of its own proportions, a crest
 * on the head and something behind the shoulders.
 *
 * `skirt` is [waistRadius, hemRadius, dropDepth]. `crest` and `back` name the
 * shapes built further down. `sideLock` is how far the face-framing hair falls,
 * and it does more work than any other number here: it is the difference
 * between a face and a sphere with eyes on it.
 */
const SILHOUETTE = {
  // 검수: narrow and upright, with the sword-sash streamers behind.
  seolryeong: { skirt: [0.18, 0.44, 0.18], crest: 'pin', back: 'streamers', sideLock: 0.42 },
  // 화염: short and wide, so she reads as planted when she burns something.
  hongryeon: { skirt: [0.21, 0.52, 0.14], crest: 'topknot', back: 'tail', sideLock: 0.26 },
  // 요족: cropped robe that lets the tail carry the outline.
  cheongmyo: { skirt: [0.16, 0.34, 0.10], crest: 'ears', back: 'tail', sideLock: 0.22 },
  // 독: a long trailing over-robe that drags.
  byeongna: { skirt: [0.19, 0.44, 0.34], crest: 'veil', back: 'drape', sideLock: 0.38, ahoge: false },
  // 술사: tall scholar's cap over a narrow column.
  mukyeon: { skirt: [0.16, 0.36, 0.32], crest: 'cap', back: 'drape', sideLock: 0.30, ahoge: false },
  // 수집가: a broad 삿갓 and a full skirt.
  baengno: { skirt: [0.22, 0.56, 0.18], crest: 'hat', back: 'streamers', sideLock: 0.32, ahoge: false },
}

const DEFAULT_SILHOUETTE = { skirt: [0.18, 0.44, 0.26], crest: 'pin', back: 'streamers', sideLock: 0.32 }

export function buildChibi(character) {
  if (character.id === 'seolryeong') return buildImg2ThreeSeolryeong(character)
  const pal = character.palette
  const sil = SILHOUETTE[character.id] ?? DEFAULT_SILHOUETTE
  const root = new THREE.Group()
  // The camera is tuned for horde readability, not for a portrait close-up.
  // Keep the model large enough to anchor the frame, but move the silhouette
  // toward an action-RPG proportion instead of enlarging the head to make the
  // face survive at distance.
  root.scale.setScalar(1.70)

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
  headPivot.position.y = 1.62
  // Tipped back toward the camera. The play camera looks down steeply, and on an
  // upright spherical head that means the player spends the whole run staring at
  // the top of her scalp — the face, which is the entire point of the character,
  // ends up as a thin band at the bottom of the head. Only .y is animated, so
  // this base tilt survives.
  //
  // -0.34 was not enough: at play distance the visible face was forehead and the
  // upper half of the eyes. This is most of the way to facing the camera square,
  // and stops short of the angle where the profile reads as staring at the sky.
  headPivot.rotation.x = -0.32
  // Face and hair remain detailed, but the head no longer dominates the body.
  // Scaling the shared pivot keeps all facial, hair and crest offsets aligned.
  headPivot.scale.setScalar(0.37)
  root.add(headPivot)

  // Slightly narrower and shorter than before. With the hair mass on top the
  // head was reading as roughly 60% of her whole silhouette, which is past
  // chibi and into bobblehead — there was no body left to recognise.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), skinMat)
  head.scale.set(0.94, 0.92, 0.9)
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

  // Crown, bangs, side locks and ahoge, merged into one mesh. See buildHair.
  const hair = new THREE.Mesh(buildHair(pal, sil), hairVertexMat)
  hair.castShadow = true
  headPivot.add(hair)

  const strands = []
  const addStrand = (x, y, z, len, rz, radius = 0.09) => {
    // A tapered tube hanging from its attachment point, not a capsule centred on
    // its middle: the taper reads as hair and the pivot lands where the strand
    // actually meets the head, so the sway swings from the root.
    // Ten radial segments, not seven. At this thickness a heptagonal tube shows
    // each facet as a broad flat plane, and a strand of hair lit as five visible
    // planes reads as a carved board — which is exactly what these looked like.
    const geo = limb(
      [[0, 0, 0], [0, -len * 0.45, len * 0.06], [0, -len * 0.82, len * 0.02], [0, -len * 1.05, -len * 0.08]],
      // Real radii, not multipliers scaled afterwards. A post-hoc scale(r, 1, r)
      // leaves the tube's full Y extent intact wherever the curve leans, which
      // hung an invisible spike off every flick at the tip. See hairLock.
      [radius, radius * 1.12, radius * 0.78, radius * 0.18], 12, 10,
    )
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
    // Long twintails. Narrow, because at 0.10 they were as wide as her forearm
    // and read as two flat paddles bolted to her head rather than as hair.
    // Measured at 1.46 units tall before this — hanging from her head to below
    // her own feet, which is why they read as two slabs flanking her instead of
    // as hair. A twintail ends around the waist.
    addStrand(-0.38, 1.00, -0.10, 0.34, 0.14, 0.044)
    addStrand(0.38, 1.00, -0.10, 0.34, -0.14, 0.044)
    addStrand(-0.30, 0.96, -0.22, 0.24, 0.26, 0.032)
    addStrand(0.30, 0.96, -0.22, 0.24, -0.26, 0.032)
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
  torso.position.y = 1.04
  torso.scale.set(1.12, 1.42, 1.10)
  torso.castShadow = true
  root.add(torso)

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.20, 0.10, 12), trimMat)
  collar.position.y = 1.35
  root.add(collar)

  // A layered chest bib breaks the deep toon shadow on the front of the lathed
  // torso and gives the cultivator a clear martial-robe construction at play
  // distance: shoulder mantle, central panel, waist clasp.
  const bibGeo = buildColored([
    [new THREE.BoxGeometry(0.22, 0.48, 0.055), { y: 1.10, z: 0.245 }, shade(pal.cloth, 1.22)],
    [new THREE.BoxGeometry(0.045, 0.42, 0.018), { y: 1.10, z: 0.279 }, pal.trim],
    [new THREE.BoxGeometry(0.22, 0.045, 0.018), { y: 1.29, z: 0.279 }, pal.trim],
    [new THREE.OctahedronGeometry(0.055, 0), { y: 1.30, z: 0.295 }, pal.accent],
  ])
  const bib = new THREE.Mesh(bibGeo, clothVertexMat)
  bib.castShadow = true
  root.add(bib)

  // Layered shoulder guards and a central chest clasp give the torso a designed
  // hard-surface break. A single smooth robe was reading as one coloured blob
  // once the oversized head was removed.
  const shoulderGeo = buildColored([
    [new THREE.SphereGeometry(0.17, 12, 8), { x: -0.32, y: 1.28, z: 0.01, sx: 1.25, sy: 0.42, sz: 0.78 }, shade(pal.trim, 0.78)],
    [new THREE.SphereGeometry(0.17, 12, 8), { x: 0.32, y: 1.28, z: 0.01, sx: 1.25, sy: 0.42, sz: 0.78 }, shade(pal.trim, 0.78)],
    [new THREE.BoxGeometry(0.13, 0.34, 0.07), { y: 1.18, z: 0.25 }, pal.accent],
    [new THREE.OctahedronGeometry(0.08, 0), { y: 1.20, z: 0.31 }, pal.trim],
  ])
  const shoulders = new THREE.Mesh(shoulderGeo, clothVertexMat)
  shoulders.castShadow = true
  root.add(shoulders)

  // A back-slung sword is visible even before the first projectile fires, which
  // makes the selected character read as a cultivator rather than a mannequin.
  const sheathGeo = buildMerged([
    [new THREE.CylinderGeometry(0.055, 0.07, 0.86, 8), { y: 1.18, z: -0.31, rz: -0.38 }],
    [new THREE.TorusGeometry(0.075, 0.018, 5, 12), { y: 0.96, z: -0.31, rz: -0.38 }],
    [new THREE.ConeGeometry(0.08, 0.16, 6), { y: 1.58, z: -0.31, rz: -0.38 }],
  ])
  const sheath = new THREE.Mesh(sheathGeo, trimMat)
  sheath.castShadow = true
  root.add(sheath)

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
    arm.position.set(side * 0.32, 1.00, 0)
    arm.castShadow = true
    root.add(arm)
    arms.push(arm)

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 8), skinMat)
    hand.scale.set(1, 1.15, 0.9)
    hand.position.set(side * 0.32, 0.72, 0)
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

  // ---- Crest ---------------------------------------------------------------
  // Sits on top of the head where nothing else competes with it, which at this
  // camera is the most legible part of the whole character.
  if (sil.crest === 'topknot') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), hairMat)
    bun.position.set(0, 0.52, -0.06)
    bun.scale.set(1, 0.85, 1)
    headPivot.add(bun)
    const pinRod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 6), trimMat)
    pinRod.position.set(0, 0.54, -0.06)
    pinRod.rotation.z = 1.15
    headPivot.add(pinRod)
  } else if (sil.crest === 'cap') {
    // A scholar's cap: a tall block with a brim, unmistakable in outline.
    const capBody = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.20, 0.34, 8), clothMat)
    capBody.position.set(0, 0.52, -0.03)
    headPivot.add(capBody)
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.035, 10), trimMat)
    brim.position.set(0, 0.37, -0.03)
    headPivot.add(brim)
  } else if (sil.crest === 'hat') {
    // 삿갓: a wide cone that reads from any angle and shades the face.
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.26, 12), trimMat)
    hat.position.set(0, 0.46, -0.02)
    headPivot.add(hat)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), clothMat)
    knob.position.set(0, 0.60, -0.02)
    headPivot.add(knob)
  } else if (sil.crest === 'veil') {
    const veil = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.44),
      trimMat,
    )
    veil.position.set(0, 0.10, -0.04)
    veil.scale.set(1.05, 1.25, 1.05)
    veil.material.side = THREE.DoubleSide
    headPivot.add(veil)
  } else if (sil.crest === 'pin') {
    // Minimal by design: 설령 carries her read in the twintails.
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6), trimMat)
    pin.position.set(0.12, 0.40, -0.10)
    pin.rotation.z = -0.9
    headPivot.add(pin)
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), hairMat)
    bead.position.set(0.27, 0.47, -0.10)
    headPivot.add(bead)
  }

  // ---- Behind the shoulders ------------------------------------------------
  if (character.id === 'seolryeong') {
    // Her signature is a pale, wind-caught sword mantle. The old blue torso was
    // readable but did not carry the white-robed sword cultivator silhouette of
    // the setting; these tapered cloth planes add that shape without changing
    // hitboxes or the survivor camera's central clearing.
    const cloakMat = makeToonMaterial({
      color: 0xffffff,
      rim: 0.52,
      rimColor: pal.accent,
      side: THREE.DoubleSide,
      vertexColors: true,
    })
    const cloak = limb(
      [[0, 1.22, -0.16], [0, 0.86, -0.32], [0, 0.42, -0.43], [0, 0.08, -0.52]],
      [0.30, 0.35, 0.21, 0.025], 14, 7,
    )
    gradient(cloak, 0xf7fbff, 0x7198c6, 'y')
    const cloakMesh = new THREE.Mesh(cloak, cloakMat)
    cloakMesh.castShadow = true
    root.add(cloakMesh)
    for (const side of [-1, 1]) {
      const panel = limb(
        [[side * 0.18, 1.18, -0.12], [side * 0.32, 0.82, -0.30], [side * 0.46, 0.42, -0.40], [side * 0.60, 0.12, -0.48]],
        [0.16, 0.19, 0.11, 0.018], 12, 6,
      )
      gradient(panel, 0xffffff, 0x8ab4e0, 'y')
      const panelMesh = new THREE.Mesh(panel, cloakMat)
      panelMesh.castShadow = true
      root.add(panelMesh)
    }
    const heldBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.78, 0.025),
      makeToonMaterial({ color: 0xeaf7ff, rim: 0.9, rimColor: pal.accent }),
    )
    heldBlade.position.set(0.47, 0.94, 0.20)
    heldBlade.rotation.z = -0.58
    heldBlade.castShadow = true
    root.add(heldBlade)
  }

  if (sil.back === 'drape') {
    // A long over-robe reaching the ground: the tallest back shape, and the one
    // that most changes the outline from the side.
    for (const [dx, len] of [[-0.13, 1.0], [0.06, 1.16], [0.16, 0.94]]) {
      const geo = limb(
        [[dx, 1.05, -0.12], [dx * 1.3, 0.72, -0.2], [dx * 1.5, 0.3, -0.22], [dx * 1.4, 1.05 - len, -0.16]],
        [0.85, 0.95, 0.72, 0.3], 12, 8,
      )
      geo.scale(0.14, 1, 0.09)
      gradient(geo, shade(pal.cloth, 0.55), shade(pal.cloth, 0.95), 'y')
      const panel = new THREE.Mesh(geo, clothVertexMat)
      panel.castShadow = true
      root.add(panel)
    }
  } else if (sil.back === 'streamers') {
    for (const side of [-1, 1]) {
      const geo = limb(
        [[side * 0.1, 0.86, -0.16], [side * 0.2, 0.6, -0.3], [side * 0.16, 0.3, -0.28]],
        [0.6, 0.8, 0.2], 10, 7,
      )
      geo.scale(0.075, 1, 0.05)
      gradient(geo, pal.trim, shade(pal.trim, 1.2), 'y')
      root.add(new THREE.Mesh(geo, clothVertexMat))
    }
  }

  // ---- Skirt ---------------------------------------------------------------
  // A flared robe turned on a lathe, not a plain cone: the hem kicks out and the
  // waist pinches, which is what makes it read as cloth rather than a funnel.
  const [waistR, hemR, drop] = sil.skirt
  const skirtGeo = revolve([
    [waistR, 0.30],
    [waistR + (hemR - waistR) * 0.16, 0.30 - drop * 0.42],
    [waistR + (hemR - waistR) * 0.36, 0.30 - drop * 0.99],
    [waistR + (hemR - waistR) * 0.62, 0.30 - drop * 1.53],
    [hemR * 0.94, 0.30 - drop * 1.92],
    [hemR, 0.30 - drop * 2.09],
    [hemR * 0.93, 0.30 - drop * 2.15],
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
  // Drawn through the crowd. This ring is the player's locator, and in a real
  // horde the creatures standing on it hide it exactly when it is most needed —
  // "where am I" has to be answerable at a glance with 130 enemies on screen.
  ring.material.depthTest = false
  ring.renderOrder = 3
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

  /**
   * Afterimages behind each orbiting blade.
   *
   * Every projectile in the game got a motion trail, and the 어검술 swords —
   * which are on screen continuously rather than for half a second — were the
   * one moving thing left with none. Three ghosts per sword, placed at earlier
   * points on the same orbit and fading back, so the ring reads as three blades
   * sweeping rather than three blades teleporting around her.
   */
  const GHOSTS_PER_SWORD = 3
  const ghosts = []
  for (let i = 0; i < 3 * GHOSTS_PER_SWORD; i++) {
    const fade = 1 - (i % GHOSTS_PER_SWORD) / GHOSTS_PER_SWORD
    const g = new THREE.Mesh(swordGeo, makeAdditiveMaterial({
      color: pal.accent, opacity: 0.30 * fade * fade,
    }))
    g.visible = false
    ghosts.push(g)
    root.add(g)
  }

  // Only the character casts shadows; receiving them on a low-poly figure this
  // small just produces acne.
  root.traverse((o) => { if (o.isMesh) o.receiveShadow = false })

  // Cel outlines on the silhouette masses only. Shelling all ~30 child meshes
  // would double the player's draw calls for detail invisible at gameplay
  // distance; the head, hair, torso and skirt carry the read.
  const outlineMat = makeOutlineMaterial(0.024)
  // The crown is deliberately not outlined. A hard black rim around it separates
  // it from the bangs underneath and the whole thing reads as a hat sitting on
  // her head; the head and back hair already carry the silhouette.
  for (const source of [head, hairBack, torso, skirt]) {
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
      for (let i = 0; i < ghosts.length; i++) {
        ghosts[i].visible = Math.floor(i / GHOSTS_PER_SWORD) < swordCount
      }
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
      const place = (mesh, a, t) => {
        _v.set(Math.cos(a) * 0.82, 0.95 + Math.sin(a * 2 + t) * 0.10, Math.sin(a) * 0.82)
        mesh.position.copy(_v)
        mesh.rotation.set(Math.PI * 0.92, -a + Math.PI / 2, 0)
      }
      for (let i = 0; i < swordCount; i++) {
        const a = time * 1.4 + (i / swordCount) * Math.PI * 2
        place(swords[i], a, time)
        // Ghosts sit further back along the same orbit, shrinking as they go.
        for (let gi = 0; gi < GHOSTS_PER_SWORD; gi++) {
          const lag = (gi + 1) * 0.085
          const ghost = ghosts[i * GHOSTS_PER_SWORD + gi]
          place(ghost, a - lag * 1.4, time - lag)
          ghost.scale.setScalar(1 - (gi + 1) * 0.13)
        }
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
