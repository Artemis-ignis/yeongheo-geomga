import * as THREE from 'three'
import { createRenderer, createScene, isWebGL2Available, resizeToWindow, shadowFollow, showFallback } from './world/Scene.js'
import { FollowCamera } from './world/Camera.js'
import { makeToonMaterial, PALETTE } from './art/materials.js'
import { installCapture } from './dev/capture.js'

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

  // Temporary stand-in geometry until the real terrain and player land.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    makeToonMaterial({ color: PALETTE.jadeDark, rim: 0 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const stand = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.0, 6, 14),
    makeToonMaterial({ color: PALETTE.jade, rim: 0.6, rimColor: 0xbff5e2 }),
  )
  stand.position.y = 1.0
  stand.castShadow = true
  scene.add(stand)

  resizeToWindow(renderer, follow, overlayCanvas)
  addEventListener('resize', () => resizeToWindow(renderer, follow, overlayCanvas))

  let last = performance.now()
  const draw = () => {
    shadowFollow(sun, stand.position.x, stand.position.z)
    renderer.render(scene, follow.camera)
  }

  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 0.25)
    last = now
    const t = now * 0.00035
    stand.position.set(Math.cos(t) * 14, 1.0, Math.sin(t) * 14)
    follow.update(stand.position.x, stand.position.z, dt)
    draw()
  })

  if (import.meta.env.DEV) {
    window.__forceFallback = () => showFallback('테스트')
    installCapture(renderer, (w, h) => {
      follow.setAspect(w / h)
      draw()
    })
  }
}
