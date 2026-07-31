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
    // Twelve 30-degree hue bins, counting only pixels colourful enough for their
    // hue to mean anything.
    const hues = new Array(12).fill(0)
    let coloured = 0
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

      if (sat > 0.15 && luma > 0.05) {
        const d = max - min
        let h
        if (max === r) h = ((g - b) / d + 6) % 6
        else if (max === g) h = (b - r) / d + 2
        else h = (r - g) / d + 4
        hues[Math.min(11, Math.floor((h / 6) * 12))]++
        coloured++
      }
    }

    const mean = sum / n
    const meanSat = sumSat / n
    // Spread of the luminance histogram: a healthy frame uses a wide range, a
    // washed-out or crushed one collapses into a few buckets.
    const used = hist.filter((c) => c / n > 0.01).length
    // Share of coloured pixels sitting in the single most common hue bin.
    //
    // This is here because the rest of the metrics passed a frame that was
    // visibly ruined. A leak was stacking seven screen-wide additively blended
    // 팔괘진 planes, and additive layers sum rather than average, so the entire
    // playfield had burned to one flat orange with the character barely legible
    // on it. Mean luma read 0.38 and nothing was blown, because brightness was
    // never what failed — the palette was. A frame where four fifths of the
    // colour is one hue has stopped being a picture of anything.
    const dominant = coloured === 0 ? 0 : Math.max(...hues) / coloured

    return {
      meanLuma: +mean.toFixed(4),
      meanSaturation: +meanSat.toFixed(4),
      blackFraction: +(black / n).toFixed(4),
      blownFraction: +(blown / n).toFixed(4),
      histogramBucketsUsed: used,
      dominantHueShare: +dominant.toFixed(4),
      histogram: hist.map((c) => +(c / n).toFixed(3)),
      hues: hues.map((c) => +(c / Math.max(1, coloured)).toFixed(3)),
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
  /**
   * 0.97, raised from 0.85, and the raise is a correction rather than a
   * concession.
   *
   * 0.85 was set when the ground mist was an additive wash at 0.35 covering the
   * whole plateau, which held every frame's saturation artificially down. It
   * never described the shipped game: sampled at 1:30 with that mist in place,
   * 청람비경 reads 0.940 and 한천비경 0.943. The gate had been failing the game
   * as shipped in two 비경 out of three the entire time and nobody had sampled
   * the opening to notice.
   *
   * A ceiling nothing can satisfy is not a gate, it is noise you learn to skip.
   * At 0.97 it still catches a frame that has gone fully monochromatic-saturated
   * while passing the stages' own palettes, which really are this vivid — the
   * jade plateau is a saturated green and most of the screen is ground.
   */
  meanSaturation: [0.12, 0.97],
  blackFraction: [0, 0.45],
  blownFraction: [0, 0.12],
  histogramBucketsUsed: [4, 16],
  // `dominantHueShare` is measured and reported but deliberately not gated.
  //
  // It was added to catch the frame that all the limits above passed: a leak
  // stacking seven screen-wide additive 팔괘진 planes had burned the whole
  // playfield to flat orange, and mean luma read 0.38 with nothing blown,
  // because brightness was never what failed. Hue concentration does move on
  // that frame — 0.51 healthy against 0.71 with six planes replanted.
  //
  // It is not a threshold, though, and the measurement says so. Sampled every
  // minute of a clean four-minute run: 청람비경 peaks at 0.87 and 한천비경 at
  // 0.82, because their floor is one colour by design and the floor is most of
  // the screen. Any limit that catches the leak also fails those. Left here as
  // a diagnostic to read alongside a screenshot, not as a gate that would cry
  // wolf on every jade run.
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
