import * as THREE from 'three'
import { buildChibi } from './ChibiBuilder.js'

/**
 * Bake a character's chibi into a head-and-shoulders portrait.
 *
 * The character-select screen showed six text cards and a weapon glyph — no
 * face anywhere, on the one screen whose entire job is making you want to play
 * one of them. Every game in this genre puts the character on that card.
 *
 * The models already exist, so this renders them rather than asking anyone to
 * draw six portraits: same geometry, same materials, same shading, just framed
 * on the face and lit for a card instead of for a battlefield. That also means a
 * portrait can never drift out of step with what you get in play, which is the
 * usual failure of hand-authored key art next to a stylised model.
 *
 * Rendered into an offscreen target rather than the visible canvas: reading the
 * drawing buffer needs `preserveDrawingBuffer`, which costs a full copy on every
 * frame of the game for the sake of six images taken once.
 */

const SIZE = 256

/**
 * Portraits are baked once per session and cached by character id. Six chibis
 * are a few thousand triangles; keeping the images is far cheaper than keeping
 * the models alive.
 */
const cache = new Map()

/**
 * @param {object} character An entry from CHARACTERS.
 * @param {THREE.WebGLRenderer} renderer The game's renderer, borrowed briefly.
 * @returns {string} A data URL, or '' if anything about the GL path failed.
 */
export function portraitFor(character, renderer) {
  if (cache.has(character.id)) return cache.get(character.id)
  const url = bake(character, renderer)
  cache.set(character.id, url)
  return url
}

function bake(character, renderer) {
  if (!renderer) return ''
  let chibi = null
  let target = null
  try {
    const scene = new THREE.Scene()

    // Lit from the front-left with a cool fill, so the face reads as a face
    // rather than as the flat silhouette the gameplay lighting gives it from
    // above. Portrait lighting, not battlefield lighting.
    const key = new THREE.DirectionalLight(0xfff4e6, 2.5)
    key.position.set(-2.2, 3.4, 4.2)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x9fc8ff, 0.9)
    fill.position.set(3.0, 1.2, 2.0)
    scene.add(fill)
    scene.add(new THREE.AmbientLight(0xdfe8f5, 1.05))
    // A rim from behind picks the hair off a dark card.
    const rim = new THREE.DirectionalLight(character.palette.accent ?? 0xffffff, 1.4)
    rim.position.set(0.4, 2.0, -3.4)
    scene.add(rim)

    chibi = buildChibi(character)
    // Face the camera squarely and drop the idle tilt the gameplay pose uses.
    chibi.root.rotation.set(0, 0, 0)
    scene.add(chibi.root)

    // Frame on the head. The models are authored around 1.9 units tall before
    // the builder's own 1.34 scale, which puts the face near y = 2.2.
    //
    // Tight. The first pass sat at z 6.4 with a 24-degree lens and the head came
    // out under half the frame — legible, but a picture of a small doll rather
    // than a portrait, and the face is the entire reason this exists.
    const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 40)
    camera.position.set(0, 2.30, 4.5)
    camera.lookAt(0, 2.18, 0)

    target = new THREE.WebGLRenderTarget(SIZE, SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      colorSpace: THREE.SRGBColorSpace,
    })

    const prevTarget = renderer.getRenderTarget()
    const prevClear = renderer.getClearAlpha()
    renderer.setRenderTarget(target)
    renderer.setClearColor(0x000000, 0)
    renderer.clear(true, true, true)
    renderer.render(scene, camera)

    const pixels = new Uint8Array(SIZE * SIZE * 4)
    renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels)
    renderer.setRenderTarget(prevTarget)
    renderer.setClearAlpha(prevClear)

    return toDataURL(pixels)
  } catch {
    // A portrait is decoration. Losing one must never cost the menu.
    return ''
  } finally {
    if (chibi) chibi.dispose?.()
    if (target) target.dispose()
  }
}

/** GL reads bottom-up; a canvas is top-down. */
function toDataURL(pixels) {
  if (typeof document === 'undefined') return ''
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const image = ctx.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y++) {
    const src = (SIZE - 1 - y) * SIZE * 4
    image.data.set(pixels.subarray(src, src + SIZE * 4), y * SIZE * 4)
  }
  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Drop the cache — only needed if a palette changes at runtime. */
export function clearPortraits() {
  cache.clear()
}
