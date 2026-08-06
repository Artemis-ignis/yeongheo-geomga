import * as THREE from 'three'
import { PALETTE } from '../art/materials.js'
export { isWebGL2Available, showFallback } from './webglSupport.js'

const SHADOW_EXTENT = 26

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    // FXAA is part of the post stack; driver MSAA would duplicate the colour-buffer cost.
    antialias: false,
    powerPreference: 'high-performance',
  })
  // Starting point only — Quality takes over and scales this from measured
  // frame time. A fixed 2 on a high-DPI panel renders 4x the pixels of 1x.
  // Start at 1x; Quality raises the scale only after measuring real frame time.
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.backendLabel = renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL'
  return renderer
}

export function createScene(palette = {}) {
  const scene = new THREE.Scene()
  // Fog colour matches the sky haze so the plateau edge dissolves into the horizon
  // instead of ending on a hard line.
  scene.fog = new THREE.FogExp2(palette.fog ?? PALETTE.fog, 0.0085)

  // Key and fill, with a real gap between them.
  //
  // These were 0.85 and 1.35, which is close enough to equal that every surface
  // landed on the same band of the toon ramp whichever way it faced. That is
  // what made the art read as flat: not the polygon count, but a rig with no
  // opinion about where the light comes from. The fill is now well under the
  // key, and the key sits much lower in the sky — at 34 units up it was almost
  // directly overhead, so every shadow hid underneath the thing casting it.
  // A little more cool fill keeps dark armour and enemy silhouettes readable
  // after bloom is removed from the safe base tier.
  const hemi = new THREE.HemisphereLight(0x9fc8e8, 0x3a4a3c, 0.64)
  scene.add(hemi)

  // Only lightly warm. At 0xffe9c4 and this intensity a silver-haired character
  // came out cream, and white cloth came out tan — the tint was reading as the
  // material's own colour rather than as sunlight on it.
  // Moonlit jade and frost stay cool so white silk does not turn beige. A stage
  // may opt into a warmer key for the ember realm without changing the shared
  // renderer or material palette.
  const sun = new THREE.DirectionalLight(palette.keyLight ?? 0xd7e9ff, 2.05)
  sun.position.set(20, 17, 13)
  sun.castShadow = true
  // A 1024 shadow atlas is enough for the tight follow frustum and avoids
  // paying a 4x memory/fill cost on integrated GPUs.
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
