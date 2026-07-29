/**
 * Dev-only frame tone analysis.
 *
 * Borrowed from the verification approach in achimala/TheLongSilence: rather
 * than eyeballing screenshots, read the rendered frame back and assert its tone
 * is in range. Two real regressions in this project would have been caught
 * automatically by this — lighting summing past 1.0 and washing the whole
 * palette to pastel, and every enemy rendering pure black behind an outline
 * hull. Both looked "fine" in a thumbnail and both were obvious in the numbers.
 *
 * Exposed as `window.__tone()`.
 */
export function installToneCheck(renderer, drawFrame) {
  if (typeof window === 'undefined') return

  window.__tone = (width = 480, height = 270) => {
    const prevRatio = renderer.getPixelRatio()
    const prev = renderer.getSize({ x: 0, y: 0, set(x, y) { this.x = x; this.y = y; return this } })

    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    drawFrame(width, height)
    drawFrame(width, height)

    const gl = renderer.getContext()
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    renderer.setPixelRatio(prevRatio)
    renderer.setSize(prev.x, prev.y, false)

    let sum = 0
    let sumSat = 0
    let black = 0
    let blown = 0
    const hist = new Array(16).fill(0)
    const n = width * height

    for (let i = 0; i < n; i++) {
      const r = pixels[i * 4] / 255
      const g = pixels[i * 4 + 1] / 255
      const b = pixels[i * 4 + 2] / 255
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max

      sum += luma
      sumSat += sat
      if (luma < 0.02) black++
      if (luma > 0.98) blown++
      hist[Math.min(15, Math.floor(luma * 16))]++
    }

    const mean = sum / n
    const meanSat = sumSat / n
    // Spread of the luminance histogram: a healthy frame uses a wide range, a
    // washed-out or crushed one collapses into a few buckets.
    const used = hist.filter((c) => c / n > 0.01).length

    return {
      meanLuma: +mean.toFixed(4),
      meanSaturation: +meanSat.toFixed(4),
      blackFraction: +(black / n).toFixed(4),
      blownFraction: +(blown / n).toFixed(4),
      histogramBucketsUsed: used,
      histogram: hist.map((c) => +(c / n).toFixed(3)),
    }
  }
}

/**
 * Measure the tone of the *lit models alone*, against black.
 *
 * A whole-frame metric is the wrong instrument for this scene: sky and grass are
 * custom shaders that ignore scene lights and cover most of the pixels, so
 * killing every light moves mean luminance by 0.07 and a full washout moves it
 * by 0.04. Both regressions this tool exists to catch were invisible that way.
 *
 * Hiding everything except the characters and the horde, and measuring only the
 * pixels they actually cover, makes both loud: black models drop `coverage` and
 * `meanLuma` to nothing, a washout collapses `meanSaturation`.
 */
export function installModelTone(renderer, scene, camera, collectSubjects) {
  if (typeof window === 'undefined') return

  window.__modelTone = (width = 420, height = 240) => {
    const subjects = new Set(collectSubjects())
    const hidden = []
    scene.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return
      if (subjects.has(o)) return
      if (o.visible) { hidden.push(o); o.visible = false }
    })
    const prevBg = scene.background
    const prevFog = scene.fog
    scene.background = null
    scene.fog = null

    const prevRatio = renderer.getPixelRatio()
    const prev = renderer.getSize({ x: 0, y: 0, set(x, y) { this.x = x; this.y = y; return this } })
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    // Straight to the canvas, bypassing post — bloom and grading would colour
    // the measurement and hide exactly what we are trying to see.
    renderer.setClearColor(0x000000, 1)
    renderer.clear()
    renderer.render(scene, camera)

    const gl = renderer.getContext()
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    renderer.setPixelRatio(prevRatio)
    renderer.setSize(prev.x, prev.y, false)
    scene.background = prevBg
    scene.fog = prevFog
    for (const o of hidden) o.visible = true

    let lit = 0
    let sumLuma = 0
    let sumSat = 0
    const n = width * height
    for (let i = 0; i < n; i++) {
      const r = pixels[i * 4] / 255
      const g = pixels[i * 4 + 1] / 255
      const b = pixels[i * 4 + 2] / 255
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      if (luma < 0.012) continue
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      lit++
      sumLuma += luma
      sumSat += max === 0 ? 0 : (max - min) / max
    }

    return {
      coverage: +(lit / n).toFixed(4),
      meanLuma: lit ? +(sumLuma / lit).toFixed(4) : 0,
      meanSaturation: lit ? +(sumSat / lit).toFixed(4) : 0,
    }
  }
}

/**
 * What the models alone should look like when they are rendering correctly.
 *
 * Calibrated by sweeping light intensity and watching the response, which is
 * cleanly monotonic: at sun/hemi 1.35/0.85 the models sit at luma 0.34 and
 * saturation 0.43, and by 8/6 they have climbed to 0.59 luma and fallen to 0.26
 * saturation. These bounds sit either side of healthy with room to spare.
 *
 * This catches gross regressions — models not drawing, or the palette blowing
 * out — not subtle drift. It is a smoke alarm, not a colourimeter.
 */
export const MODEL_TONE_LIMITS = {
  coverage: [0.003, 0.9],
  meanLuma: [0.15, 0.48],
  meanSaturation: [0.34, 0.92],
}

/**
 * Thresholds a healthy gameplay frame should satisfy. Kept here next to the
 * measurement so the expectations and the metric never drift apart.
 */
export const TONE_LIMITS = {
  meanLuma: [0.06, 0.62],
  meanSaturation: [0.12, 0.85],
  blackFraction: [0, 0.45],
  blownFraction: [0, 0.12],
  histogramBucketsUsed: [4, 16],
}

/** Returns a list of human-readable failures, empty when the frame is healthy. */
export function checkTone(tone, limits = TONE_LIMITS) {
  const problems = []
  for (const [key, [lo, hi]] of Object.entries(limits)) {
    const v = tone[key]
    if (v < lo) problems.push(`${key} ${v} below ${lo}`)
    else if (v > hi) problems.push(`${key} ${v} above ${hi}`)
  }
  return problems
}
