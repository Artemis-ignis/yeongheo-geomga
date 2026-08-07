import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildImg2ThreeSeolryeong } from '../art/SeolryeongImg2ThreeAdapter.js'
import { getCharacter } from '../data/characters.js'

const canvas = document.getElementById('compare')
const status = document.getElementById('status')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const heroHeight = 4.55
const scenes = [createComparisonScene(), createComparisonScene()]
const cameras = scenes.map(() => new THREE.PerspectiveCamera(31, 1, 0.1, 100))
const runtimeHero = buildImg2ThreeSeolryeong(getCharacter('seolryeong'))
runtimeHero.root.position.y = 0.02
scenes[0].add(runtimeHero.root)

const trellisRoot = new THREE.Group()
trellisRoot.name = 'seolryeong-trellis-reference-proxy'
trellisRoot.visible = false
scenes[1].add(trellisRoot)

const loader = new GLTFLoader()
loader.load(
  '/artifacts/img2threejs/seolryeong/character-model-v4/trellis-mesh/reference.glb',
  (gltf) => {
    const proxy = gltf.scene
    const bounds = new THREE.Box3().setFromObject(proxy)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    bounds.getSize(size)
    bounds.getCenter(center)
    const scale = heroHeight / Math.max(0.001, size.y)
    proxy.scale.setScalar(scale)
    proxy.position.set(-center.x * scale, -bounds.min.y * scale + 0.02, -center.z * scale)
    proxy.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if (!material) return
        material.roughness = Math.max(0.34, material.roughness ?? 0.62)
        material.metalness = Math.min(0.55, material.metalness ?? 0.08)
        material.envMapIntensity = 1.2
        material.needsUpdate = true
      })
    })
    trellisRoot.add(proxy)
    trellisRoot.visible = true
    status.textContent = `비교 준비 완료 · TRELLIS ${Math.round(size.y * 1000) / 1000}u 원본 · 런타임 적용 전 시각 게이트`
  },
  undefined,
  (error) => {
    status.textContent = `reference.glb 로드 실패 · ${error?.message ?? error}`
  },
)

let paused = false
let last = performance.now()
let elapsed = 0
addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    paused = !paused
    event.preventDefault()
  }
})

function createComparisonScene() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x07111f)
  scene.fog = new THREE.Fog(0x07111f, 12, 28)
  scene.add(new THREE.HemisphereLight(0xb7d8f1, 0x14263a, 1.65))

  const key = new THREE.DirectionalLight(0xe7f3ff, 3.0)
  key.position.set(3.8, 6.2, 7.5)
  key.castShadow = true
  key.shadow.mapSize.set(768, 768)
  scene.add(key, key.target)

  const fill = new THREE.DirectionalLight(0x6c96d8, 1.25)
  fill.position.set(-5, 3.5, 3.2)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0x5fe5ff, 2.25)
  rim.position.set(0, 4.8, -6)
  scene.add(rim)

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 72),
    new THREE.MeshPhysicalMaterial({ color: 0x152c43, roughness: 0.48, metalness: 0.18, clearcoat: 0.32 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.022, 8, 72),
    new THREE.MeshBasicMaterial({ color: 0x5fe5ff, transparent: true, opacity: 0.55 }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.018
  scene.add(ring)
  scene.userData.ring = ring
  return scene
}

function resize() {
  const width = Math.max(1, innerWidth)
  const height = Math.max(1, innerHeight)
  renderer.setSize(width, height, false)
  cameras.forEach((camera) => {
    camera.aspect = (width * 0.5) / height
    camera.updateProjectionMatrix()
  })
}
addEventListener('resize', resize)
resize()

function renderPane(scene, camera, left, width, height) {
  // Fit the complete 4.55u hero in the narrow half-viewport. The previous
  // distance made the gate inspect only torso/legs, which is not enough to
  // judge face, hair, crown and sword against the turnaround reference.
  camera.position.set(0.9, 2.7, 11.6)
  camera.lookAt(0, 2.72, 0)
  renderer.setViewport(left, 0, width, height)
  renderer.setScissor(left, 0, width, height)
  renderer.render(scene, camera)
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (!paused) {
    elapsed += dt
    runtimeHero.update(dt, 0.18, Math.sin(elapsed * 0.36) * 0.22)
    runtimeHero.root.rotation.y = Math.sin(elapsed * 0.22) * 0.22
    trellisRoot.rotation.y = Math.sin(elapsed * 0.22) * 0.22
    scenes.forEach((scene) => { scene.userData.ring.rotation.z = elapsed * 0.08 })
  }

  const width = Math.max(1, Math.floor(innerWidth * renderer.getPixelRatio()))
  const height = Math.max(1, Math.floor(innerHeight * renderer.getPixelRatio()))
  renderer.setScissorTest(true)
  renderer.clear()
  renderPane(scenes[0], cameras[0], 0, Math.floor(width * 0.5), height)
  renderPane(scenes[1], cameras[1], Math.floor(width * 0.5), width - Math.floor(width * 0.5), height)
  renderer.setScissorTest(false)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

window.__heroMeshCompare = {
  pause: (on = true) => { paused = on },
  rotate: (angle = 0) => { runtimeHero.root.rotation.y = angle; trellisRoot.rotation.y = angle },
}
