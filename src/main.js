import * as THREE from 'three'
import { createRenderer, createScene, isWebGL2Available, resizeToWindow, shadowFollow, showFallback } from './world/Scene.js'
import { FollowCamera } from './world/Camera.js'
import { Terrain, ARENA_RADIUS } from './world/Terrain.js'
import { Sky } from './world/Sky.js'
import { FIXED_DT } from './core/Time.js'
import { buildChibi } from './art/ChibiBuilder.js'
import { CHARACTERS } from './data/characters.js'
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

  // Preview all three cultivators until the real player lands in Task 13.
  const chibis = CHARACTERS.map((c, i) => {
    const chibi = buildChibi(c)
    chibi.root.position.set((i - 1) * 3.2, 0, 0)
    chibi.setOrbitSwords(i + 1)
    scene.add(chibi.root)
    return chibi
  })
  const stand = chibis[1].root

  resizeToWindow(renderer, follow, overlayCanvas)
  addEventListener('resize', () => resizeToWindow(renderer, follow, overlayCanvas))

  const orbit = { radius: 18, speed: 0.35, walk: 0.8 }
  let elapsed = 0

  function update(dt) {
    elapsed += dt
    for (const c of chibis) c.update(dt, orbit.walk, elapsed * 0.4)
    terrain.update(dt, stand.position.x, stand.position.z)
    sky.update(dt, stand.position.x, stand.position.z)
    follow.update(stand.position.x, stand.position.z, dt)
  }

  function draw() {
    shadowFollow(sun, stand.position.x, stand.position.z)
    renderer.render(scene, follow.camera)
  }

  follow.snapTo(0, 0)

  let last = performance.now()
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 0.25)
    last = now
    update(dt)
    draw()
  })

  if (import.meta.env.DEV) {
    window.__scene = scene
    window.__world = { terrain, sky, follow, stand, renderer, orbit, chibis }
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
