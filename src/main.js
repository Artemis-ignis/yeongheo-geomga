import * as THREE from 'three'
import { createRenderer, createScene, isWebGL2Available, resizeToWindow, shadowFollow, showFallback } from './world/Scene.js'
import { FollowCamera } from './world/Camera.js'
import { Terrain, ARENA_RADIUS } from './world/Terrain.js'
import { Sky } from './world/Sky.js'
import { FIXED_DT } from './core/Time.js'
import { makeToonMaterial, PALETTE } from './art/materials.js'
import { installCapture, installStepper } from './dev/capture.js'

const canvas = document.getElementById('scene')
const overlayCanvas = document.getElementById('overlay')

if (!isWebGL2Available()) {
  showFallback('WebGL2 컨텍스트를 생성할 수 없습니다')
} else {
  boot()
}

function boot() {
  const renderer = createRenderer(canvas)
  const scene = createScene()
  const follow = new FollowCamera(Math.max(1, innerWidth) / Math.max(1, innerHeight))
  const sun = scene.userData.sun

  const terrain = new Terrain(scene)
  const sky = new Sky(scene)

  // Temporary stand-in until the real player lands in Task 13.
  const stand = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.0, 6, 14),
    makeToonMaterial({ color: PALETTE.jade, rim: 0.6, rimColor: 0xbff5e2 }),
  )
  stand.position.y = 1.0
  stand.castShadow = true
  scene.add(stand)

  resizeToWindow(renderer, follow, overlayCanvas)
  addEventListener('resize', () => resizeToWindow(renderer, follow, overlayCanvas))

  const orbit = { radius: 18, speed: 0.35 }
  let elapsed = 0

  function update(dt) {
    elapsed += dt
    const a = elapsed * orbit.speed
    stand.position.set(Math.cos(a) * orbit.radius, 1.0, Math.sin(a) * orbit.radius)
    terrain.clampToArena(stand.position)
    stand.position.y = 1.0
    terrain.update(dt, stand.position.x, stand.position.z)
    sky.update(dt, stand.position.x, stand.position.z)
    follow.update(stand.position.x, stand.position.z, dt)
  }

  function draw() {
    shadowFollow(sun, stand.position.x, stand.position.z)
    renderer.render(scene, follow.camera)
  }

  follow.snapTo(orbit.radius, 0)

  let last = performance.now()
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 0.25)
    last = now
    update(dt)
    draw()
  })

  if (import.meta.env.DEV) {
    window.__scene = scene
    window.__world = { terrain, sky, follow, stand, renderer, orbit }
    window.__forceFallback = () => showFallback('테스트')
    window.__stats = () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      arenaRadius: ARENA_RADIUS,
      viewRadius: +follow.viewRadius.toFixed(1),
      stand: stand.position.toArray().map((v) => +v.toFixed(1)),
    })
    installStepper(update, FIXED_DT)
    installCapture(renderer, (w, h) => {
      follow.setAspect(w / h)
      draw()
    })
  }
}
