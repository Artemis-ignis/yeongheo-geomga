import * as THREE from 'three'
import {
  createNearEnemyModel,
  disposeNearEnemyModelLibrary,
  updateNearEnemyModel,
} from '../art/NearEnemyModels.js'

const canvas = document.getElementById('near-sheet')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x101c2a)
scene.fog = new THREE.Fog(0x101c2a, 5, 12)
scene.add(new THREE.HemisphereLight(0xb7dcf0, 0x202b3d, 1.8))

const key = new THREE.DirectionalLight(0xffe0b5, 4.6)
key.position.set(2.8, 5.4, 6.4)
key.castShadow = true
key.shadow.mapSize.set(1024, 1024)
scene.add(key)

const fill = new THREE.DirectionalLight(0x6ec9ff, 2.5)
fill.position.set(-4.4, 3.6, 5.2)
scene.add(fill)

const rim = new THREE.PointLight(0x56f4dc, 6.4, 8.0, 2.0)
rim.position.set(-2.3, 2.6, -2.2)
scene.add(rim)

const warm = new THREE.PointLight(0xff7040, 3.2, 7.0, 2.0)
warm.position.set(2.6, 1.3, -1.2)
scene.add(warm)

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(2.05, 2.18, 0.16, 96),
  new THREE.MeshStandardMaterial({ color: 0x182c3a, roughness: 0.36, metalness: 0.56 }),
)
floor.position.y = -0.08
floor.receiveShadow = true
scene.add(floor)

const ring = new THREE.Mesh(
  new THREE.TorusGeometry(1.58, 0.018, 8, 96),
  new THREE.MeshBasicMaterial({ color: 0x54e4d4, transparent: true, opacity: 0.64 }),
)
ring.rotation.x = Math.PI / 2
ring.position.y = 0.015
scene.add(ring)

const model = createNearEnemyModel('demonCultivator')
if (!model) throw new Error('near demon model was not created')
model.position.y = 0.0
model.traverse((object) => {
  if (object.isMesh) {
    object.castShadow = true
    object.receiveShadow = true
  }
})
scene.add(model)

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40)
const target = new THREE.Vector3(1.15, 0.32, 0)
let lastFrameTime = performance.now()
let elapsedTime = 0
let spinning = true
let silhouette = false
const litMaterials = []
model.traverse((object) => {
  if (object.isMesh) litMaterials.push([object, object.material])
})
const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: 0x080b10 })

function resize() {
  const width = window.innerWidth || 1280
  const height = window.innerHeight || 720
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.position.set(1.30, 1.05, 7.25)
  camera.lookAt(target)
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

window.addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    spinning = !spinning
    event.preventDefault()
  }
  if (event.key.toLowerCase() === 's') {
    silhouette = !silhouette
    for (const [object, material] of litMaterials) object.material = silhouette ? silhouetteMaterial : material
    document.body.classList.toggle('silhouette', silhouette)
  }
})

window.__nearSheet = {
  render: () => renderer.render(scene, camera),
  stop: () => { spinning = false },
  modelStats: () => {
    let triangles = 0
    let meshes = 0
    model.traverse((object) => {
      if (!object.isMesh) return
      meshes += 1
      const index = object.geometry.index
      triangles += (index ? index.count : object.geometry.attributes.position.count) / 3
    })
    return { meshes, triangles: Math.round(triangles), referenceAsset: model.userData.referenceAsset }
  },
}

function frame() {
  const now = performance.now()
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000)
  lastFrameTime = now
  elapsedTime += dt
  const time = elapsedTime
  if (spinning) model.rotation.y += dt * 0.48
  updateNearEnemyModel(model, time, 0.42, 0.3)
  ring.rotation.z = time * 0.18
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

window.addEventListener('beforeunload', () => disposeNearEnemyModelLibrary())
