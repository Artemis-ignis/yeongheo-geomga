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
  // Starting point only — Quality takes over and scales this from measured
  // frame time. A fixed 2 on a high-DPI panel renders 4x the pixels of 1x.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  return renderer
}

export function createScene() {
  const scene = new THREE.Scene()
  // Fog colour matches the sky haze so the plateau edge dissolves into the horizon
  // instead of ending on a hard line.
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0085)

  // Kept well under 1.0 combined. At the previous 1.6 + 2.1 every surface was
  // multiplied past white and the whole palette washed out to pastel — which is
  // most of what made the art read as cheap, regardless of the geometry.
  const hemi = new THREE.HemisphereLight(0x9fc8e8, 0x40513f, 0.85)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffe9c4, 1.35)
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
    // Combat text is thin and needs to stay legible, but it is 2D fill on a
    // mostly empty canvas, so it can afford a higher ratio than the 3D buffer.
    const ratio = Math.min(devicePixelRatio, 1.5)
    overlayCanvas.width = Math.floor(w * ratio)
    overlayCanvas.height = Math.floor(h * ratio)
    overlayCanvas.style.width = `${w}px`
    overlayCanvas.style.height = `${h}px`
  }
}
