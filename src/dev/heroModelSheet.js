import * as THREE from 'three'
import { buildImg2ThreeSeolryeong } from '../art/SeolryeongImg2ThreeAdapter.js'
import { getCharacter } from '../data/characters.js'

const canvas = document.getElementById('hero')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x081321)
scene.fog = new THREE.Fog(0x081321, 12, 28)
scene.add(new THREE.HemisphereLight(0xb7d8f1, 0x14263a, 1.65))

const key = new THREE.DirectionalLight(0xe7f3ff, 3.2)
key.position.set(3.8, 6.2, 7.5)
key.castShadow = true
key.shadow.mapSize.set(1024, 1024)
scene.add(key, key.target)

const fill = new THREE.DirectionalLight(0x6c96d8, 1.35)
fill.position.set(-5, 3.5, 3.2)
scene.add(fill)

const rim = new THREE.DirectionalLight(0x5fe5ff, 2.6)
rim.position.set(0, 4.8, -6)
scene.add(rim)

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(3.4, 96),
  new THREE.MeshPhysicalMaterial({ color: 0x152c43, roughness: 0.48, metalness: 0.18, clearcoat: 0.32 }),
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

const ring = new THREE.Mesh(
  new THREE.TorusGeometry(2.55, 0.022, 8, 96),
  new THREE.MeshBasicMaterial({ color: 0x5fe5ff, transparent: true, opacity: 0.55 }),
)
ring.rotation.x = Math.PI / 2
ring.position.y = 0.018
scene.add(ring)

const model = buildImg2ThreeSeolryeong(getCharacter('seolryeong'))
model.root.position.y = 0.02
scene.add(model.root)

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
const target = new THREE.Vector3(0, 2.15, 0)
camera.position.set(0.9, 2.7, 8.6)
camera.lookAt(target)

let paused = false
let last = performance.now()
let elapsed = 0
addEventListener('keydown', (event) => {
  if (event.key === ' ') { paused = !paused; event.preventDefault() }
})

function resize() {
  const width = Math.max(1, innerWidth)
  const height = Math.max(1, innerHeight)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (!paused) {
    elapsed += dt
    model.update(dt, 0.18, Math.sin(elapsed * 0.36) * 0.22)
    model.root.rotation.y = Math.sin(elapsed * 0.22) * 0.22
    ring.rotation.z = elapsed * 0.08
  }
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

window.__heroSheet = {
  pause: (on = true) => { paused = on },
  rotate: (angle = 0) => { model.root.rotation.y = angle },
}
