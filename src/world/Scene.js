import * as THREE from 'three'
import { PALETTE } from '../art/materials.js'

const SHADOW_EXTENT = 26

export function isWebGL2Available() {
  try {
    const canvas = document.createElement('canvas')
    return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'))
  } catch {
    return false
  }
}

/** Replace the game with a readable explanation instead of a black screen. */
export function showFallback(reason) {
  const el = document.getElementById('fallback')
  if (!el) return
  el.innerHTML = `
    <div>
      <h1>실행할 수 없습니다</h1>
      <p>이 게임은 WebGL2가 필요합니다.<br />
      Chrome, Edge, Firefox 최신 버전에서 다시 열어주세요.</p>
      <p class="reason">사유: ${String(reason)}</p>
    </div>`
  el.hidden = false
  const scene = document.getElementById('scene')
  const overlay = document.getElementById('overlay')
  const hud = document.getElementById('hud')
  if (scene) scene.style.display = 'none'
  if (overlay) overlay.style.display = 'none'
  if (hud) hud.style.display = 'none'
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  return renderer
}

export function createScene() {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.012)

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3a4a3a, 1.6)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xfff0d6, 2.1)
  sun.position.set(18, 34, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 120
  sun.shadow.camera.left = -SHADOW_EXTENT
  sun.shadow.camera.right = SHADOW_EXTENT
  sun.shadow.camera.top = SHADOW_EXTENT
  sun.shadow.camera.bottom = -SHADOW_EXTENT
  sun.shadow.bias = -0.0008
  sun.shadow.normalBias = 0.02
  scene.add(sun)
  scene.add(sun.target)

  scene.userData.sun = sun
  scene.userData.hemi = hemi
  return scene
}

/** Keep the tight shadow frustum centred on the player. */
export function shadowFollow(light, x, z) {
  light.position.set(x + 18, 34, z + 12)
  light.target.position.set(x, 0, z)
  light.target.updateMatrixWorld()
}

export function resizeToWindow(renderer, followCamera, overlayCanvas) {
  const w = Math.max(1, innerWidth)
  const h = Math.max(1, innerHeight)
  renderer.setSize(w, h, false)
  followCamera.setAspect(w / h)
  if (overlayCanvas) {
    const ratio = Math.min(devicePixelRatio, 2)
    overlayCanvas.width = Math.floor(w * ratio)
    overlayCanvas.height = Math.floor(h * ratio)
    overlayCanvas.style.width = `${w}px`
    overlayCanvas.style.height = `${h}px`
  }
}
