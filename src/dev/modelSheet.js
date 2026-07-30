/**
 * The model contact sheet — every creature in the game, side by side, turning.
 *
 * `test/models.test.js` gates the models numerically, but a number cannot tell
 * you that a silhouette is *boring*, only that it is not degenerate. This page
 * is the other half of that loop: build procedurally, then look at the render
 * and iterate. Press S to drop to pure silhouettes, which is what the gates
 * actually measure and the fastest way to spot a creature that reads as a blob.
 *
 * Dev-only. Served at /sheet.html by the Vite dev server; never bundled into the
 * game itself.
 */
import * as THREE from 'three'
import { buildEnemyGeometry } from '../art/enemyGeometry.js'
import { buildBossGeometry } from '../art/bossGeometry.js'
import { makeToonMaterial } from '../art/materials.js'
import { measureModel, checkModel, CREATURE_GATES } from '../art/modelGates.js'
import { ENEMIES } from '../data/enemies.js'
import { CHARACTERS } from '../data/characters.js'
import { buildChibi } from '../art/ChibiBuilder.js'
import { STAGES } from '../data/stages.js'
import { installCapture } from './capture.js'

const CELL = 3.4
const DISPLAY_HEIGHT = 2.0

const BOSS_IDS = [...new Set(STAGES.flatMap((s) => [s.bosses.mid, s.bosses.final]))]

function stagesFielding(id) {
  return STAGES.filter((s) => (s.roster ?? []).includes(id)).map((s) => s.name)
}

const subjects = [
  // The playable cast comes first, because it is the part I kept judging from a
  // portrait distance on one character and then being wrong about the other
  // five. A chibi is a whole Object3D rather than one merged geometry, so these
  // carry `object` and the layout below handles either.
  ...CHARACTERS.map((c) => {
    const root = buildChibi(c).root
    // Drop the 팔괘 formation ring and the orbiting 비검. Both are gameplay
    // furniture rather than the character, and the ring is 1.9 units across —
    // it dominates the bounding box this page normalises against.
    for (const child of [...root.children]) {
      const geo = child.geometry
      if (geo && (geo.type === 'PlaneGeometry' || geo.type === 'RingGeometry')) {
        root.remove(child)
      }
    }
    return { id: c.id, name: c.name, object: root, note: '수행자' }
  }),
  ...ENEMIES.map((e) => ({
    id: e.id,
    name: e.name,
    geometry: buildEnemyGeometry(e.id),
    note: stagesFielding(e.id).join(' · ') || '—',
  })),
  ...BOSS_IDS.map((id) => ({
    id,
    name: id,
    geometry: buildBossGeometry(id),
    note: '보스',
  })),
]

const canvas = document.getElementById('sheet')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
renderer.setClearColor(0x141a24, 1)

const scene = new THREE.Scene()
// The game's own key light, so tones match what ships...
scene.add(new THREE.HemisphereLight(0x9fc8e8, 0x40513f, 0.85))
const sun = new THREE.DirectionalLight(0xffe9c4, 1.35)
sun.position.set(18, 34, 12)
scene.add(sun)
// ...plus a fill from the camera side. In game the player sees creatures against
// bright ground and through bloom; on a bare sheet the same rig leaves every
// front face in shadow, which hides the very forms this page exists to judge.
const fill = new THREE.DirectionalLight(0xcfe0ff, 0.55)
fill.position.set(-12, 10, 26)
scene.add(fill)

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200)

const lit = () =>
  makeToonMaterial({ color: 0xffffff, rim: 0.16, rimColor: 0xdce8ff, vertexColors: true })
const flat = () => new THREE.MeshBasicMaterial({ color: 0x0b0e14 })

const cols = Math.ceil(Math.sqrt(subjects.length))
const rows = Math.ceil(subjects.length / cols)
const pivots = []

subjects.forEach((subject, i) => {
  const box = new THREE.Box3()
  let mesh
  if (subject.object) {
    box.setFromObject(subject.object)
    mesh = subject.object
  } else {
    const geo = subject.geometry
    geo.computeBoundingBox()
    box.copy(geo.boundingBox)
    mesh = new THREE.Mesh(geo, lit())
  }
  const size = new THREE.Vector3()
  box.getSize(size)

  // Normalise every subject to the same on-screen height so the sheet compares
  // shape rather than scale — a boss is not "better" for being large.
  const k = DISPLAY_HEIGHT / Math.max(size.y, 1e-3)

  mesh.scale.multiplyScalar(k)
  mesh.position.y = -box.min.y * k

  const pivot = new THREE.Group()
  pivot.add(mesh)
  pivot.position.set(
    (i % cols) * CELL - ((cols - 1) * CELL) / 2,
    0,
    Math.floor(i / cols) * CELL - ((rows - 1) * CELL) / 2,
  )
  // Stagger the start angles so the sheet never shows every model head-on at
  // once — a row of identical front views hides exactly the flaw we look for.
  pivot.rotation.y = (i * 0.7) % (Math.PI * 2)
  scene.add(pivot)
  pivots.push(pivot)

  // Gates only apply to the merged creature geometries. A chibi is a hierarchy
  // of dozens of small meshes and the silhouette metrics do not describe it.
  subject.metrics = subject.geometry
    ? measureModel(subject.geometry)
    : { triangles: 0, coverage: 0, complexity: 0, turn: 0, colours: 0 }
  subject.failures = subject.geometry ? checkModel(subject.metrics, CREATURE_GATES) : []
  subject.mesh = mesh
})

// A dim floor so the models are not floating in a void.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(cols * CELL + 4, rows * CELL + 4),
  new THREE.MeshBasicMaterial({ color: 0x1b2330 }),
)
floor.rotation.x = -Math.PI / 2
floor.position.y = -0.01
scene.add(floor)

const labels = document.getElementById('labels')
const tags = subjects.map((s) => {
  const el = document.createElement('div')
  el.className = `tag${s.failures.length ? ' bad' : ''}`
  const m = s.metrics
  el.innerHTML =
    `<b>${s.name}</b><span class="sub">${s.note}</span>` +
    (s.geometry
      ? `<span class="met">tri ${m.triangles} · cov ${m.coverage.toFixed(2)} · ` +
        `cx ${m.complexity.toFixed(2)} · turn ${m.turn.toFixed(2)} · col ${m.colours}</span>`
      : '') +
    (s.failures.length ? `<span class="fail">${s.failures.join('<br>')}</span>` : '')
  labels.appendChild(el)
  return el
})

let silhouette = false
// A chibi is a hierarchy of dozens of meshes, not one, so remember the material
// of every mesh under each subject and swap them all.
const litMats = subjects.map((s) => {
  const pairs = []
  s.mesh.traverse((o) => { if (o.isMesh) pairs.push([o, o.material]) })
  return pairs
})
const flatMats = subjects.map(() => flat())
let spinning = true

addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase()
  if (key === 's') {
    silhouette = !silhouette
    subjects.forEach((s, i) => {
      for (const [node, mat] of litMats[i]) node.material = silhouette ? flatMats[i] : mat
    })
    renderer.setClearColor(silhouette ? 0xf2f4f8 : 0x141a24, 1)
    floor.visible = !silhouette
    document.body.classList.toggle('silhouette', silhouette)
  }
  if (key === ' ') { spinning = !spinning; e.preventDefault() }
})

function resize(width, height) {
  // An uncomposited dev tab reports 0×0, which would render nothing at all.
  const w = width || window.innerWidth || 1600
  const h = height || window.innerHeight || 1000
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  // Frame the whole grid whatever the window shape.
  // Fit the grid's bounding sphere, so nothing clips at any window shape.
  const half = Math.hypot((cols * CELL) / 2, (rows * CELL) / 2)
  const radius = half + DISPLAY_HEIGHT
  const vFov = (camera.fov * Math.PI) / 180
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
  const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 0.62
  const tilt = 0.62
  camera.position.set(0, dist * Math.sin(tilt), dist * Math.cos(tilt))
  camera.lookAt(0, DISPLAY_HEIGHT * 0.4, 0)
  camera.updateProjectionMatrix()
}
addEventListener('resize', () => resize())
resize()

installCapture(renderer, (w, h) => {
  resize(w, h)
  renderer.render(scene, camera)
})

const projected = new THREE.Vector3()
let last = performance.now()

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (spinning) for (const p of pivots) p.rotation.y += dt * 0.6

  renderer.render(scene, camera)

  // Park each label under its model.
  subjects.forEach((s, i) => {
    projected.set(pivots[i].position.x, -0.1, pivots[i].position.z).project(camera)
    tags[i].style.left = `${(projected.x * 0.5 + 0.5) * window.innerWidth}px`
    tags[i].style.top = `${(-projected.y * 0.5 + 0.5) * window.innerHeight}px`
  })
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// Expose the measurements so the harness can read them without a screenshot.
window.__sheet = {
  report: () => subjects.map((s) => ({ id: s.id, ...s.metrics, failures: s.failures })),
  failing: () => subjects.filter((s) => s.failures.length).map((s) => s.id),
  setSilhouette: (on) => {
    if (on !== silhouette) dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
  },
  stop: () => { spinning = false },
  render: () => renderer.render(scene, camera),
}
