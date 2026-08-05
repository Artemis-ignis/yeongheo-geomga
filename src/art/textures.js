import * as THREE from 'three'

/**
 * Runtime-generated textures. The game ships no image files, so every map in the
 * scene is drawn here with Canvas2D once at boot and cached.
 */

const cache = new Map()

function canvas(size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

function finish(c, { repeat = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(c)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  if (repeat !== 1) {
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat, repeat)
    // A tiled map on a surface the camera looks across at 52° is minified along
    // one axis and not the other. Isotropic filtering has to pick a single mip
    // for both, and the fine grain in these textures then beats against the
    // pixel grid into a regular moiré — which reads as graph paper drawn over
    // the arena, and is not a tiling seam however much it looks like one. The
    // renderer clamps this to whatever the hardware supports.
    tex.anisotropy = 16
  }
  tex.needsUpdate = true
  return tex
}

function cached(key, build) {
  let tex = cache.get(key)
  if (tex === undefined) {
    tex = build()
    cache.set(key, tex)
  }
  return tex
}

/**
 * Periodic noise: a sum of sinusoids whose wavevectors are whole numbers of
 * cycles across the tile. Returns a Float32Array roughly in [-1, 1].
 *
 * Every lattice-based noise here was eventually visible as a grid over the
 * arena. Value noise puts its sample points on a regular grid, and a regular
 * arrangement survives any amount of interpolation — pushing the cells from 3
 * texels to 20 only made the grid finer, and a normal map is the worst place
 * for it because it turns the pattern into shading. Sinusoids have no lattice
 * at all, and integer cycle counts make the field wrap exactly, so it still
 * tiles seamlessly.
 *
 * Evaluated separably: sin(A+B) = sinA·cosB + cosA·sinB, so the per-pixel inner
 * loop is multiplies and adds over precomputed row and column tables rather
 * than a million trig calls.
 */
function periodicNoise(S, { waves = 12, maxCycles = 11, seed = 1, falloff = 1 } = {}) {
  let s = seed
  const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647 }

  const field = new Float32Array(S * S)
  for (let w = 0; w < waves; w++) {
    // Cycles per tile on each axis, never zero so no wave lies along the edges.
    const a = (1 + Math.floor(rnd() * maxCycles)) * (rnd() < 0.5 ? -1 : 1)
    const b = 1 + Math.floor(rnd() * maxCycles)
    const phase = rnd() * Math.PI * 2
    const amp = 1 / Math.hypot(a, b) ** falloff

    const sinA = new Float32Array(S)
    const cosA = new Float32Array(S)
    const sinB = new Float32Array(S)
    const cosB = new Float32Array(S)
    for (let i = 0; i < S; i++) {
      const u = (Math.PI * 2 * a * i) / S
      sinA[i] = Math.sin(u)
      cosA[i] = Math.cos(u)
      const v = (Math.PI * 2 * b * i) / S + phase
      sinB[i] = Math.sin(v)
      cosB[i] = Math.cos(v)
    }
    for (let y = 0; y < S; y++) {
      const sb = sinB[y]
      const cb = cosB[y]
      const row = y * S
      for (let x = 0; x < S; x++) {
        field[row + x] += (sinA[x] * cb + cosA[x] * sb) * amp
      }
    }
  }

  let peak = 0
  for (let i = 0; i < field.length; i++) peak = Math.max(peak, Math.abs(field[i]))
  if (peak > 0) for (let i = 0; i < field.length; i++) field[i] /= peak
  return field
}

/** Draw the same shape at all nine wrapped offsets so a tile stays seamless. */
function wrapped(ctx, S, draw) {
  for (const dx of [-S, 0, S]) {
    for (const dy of [-S, 0, S]) {
      ctx.save()
      ctx.translate(dx, dy)
      draw(ctx)
      ctx.restore()
    }
  }
}

/**
 * Jade ground.
 *
 * A single flat colour with a couple of blobs reads as untextured geometry, and
 * the ground is most of every frame. This layers large-scale patches, fine
 * grain, moss clumps, cracks and a 문양 lattice so the surface holds up when the
 * camera is right on top of it.
 */
export function groundTexture(baseHex = 0x2b4d42, mossHex = 0x96d696, veinHex = 0) {
  return cached(`ground${baseHex}${mossHex}${veinHex}`, () => {
    const S = 1024
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const hex = (n) => `#${n.toString(16).padStart(6, '0')}`
    const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    const [mr, mg, mb] = rgb(mossHex)

    ctx.fillStyle = hex(baseHex)
    ctx.fillRect(0, 0, S, S)

    // Patch and crack tones are derived from the base, not fixed. Hardcoding
    // them meant every stage drifted back toward jade no matter what palette it
    // asked for — the base colour was the only thing that actually changed.
    const [br, bg, bb] = rgb(baseHex)
    const lift = (f) => [
      Math.min(255, Math.round(br * f)),
      Math.min(255, Math.round(bg * f)),
      Math.min(255, Math.round(bb * f)),
    ]
    const [lr, lg, lb] = lift(1.85)
    const [dr, dg, db] = lift(0.42)

    // Large tonal patches — the low-frequency variation that stops it looking flat.
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * S
      const y = Math.random() * S
      const r = 90 + Math.random() * 190
      const light = Math.random() > 0.45
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, light ? `rgba(${lr},${lg},${lb},0.13)` : `rgba(${dr},${dg},${db},0.16)`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      wrapped(ctx, S, (k) => { k.beginPath(); k.arc(x, y, r, 0, Math.PI * 2); k.fill() })
    }

    // Moss clumps.
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * S
      const y = Math.random() * S
      const r = 10 + Math.random() * 34
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(${mr},${mg},${mb},0.16)`)
      g.addColorStop(1, `rgba(${mr},${mg},${mb},0)`)
      ctx.fillStyle = g
      wrapped(ctx, S, (k) => { k.beginPath(); k.arc(x, y, r, 0, Math.PI * 2); k.fill() })
    }

    // Soft mottling. This layer was the grid over the whole arena, and it took
    // three attempts to kill because it looks exactly like a tiling seam.
    //
    // Per-texel white noise came first: the map is tiled and viewed at a
    // glancing angle, so it is minified on screen and noise at the texel
    // frequency folds into a regular interference pattern. Bilinear upscaling of
    // a small random buffer came second, which creases at every source cell.
    // Smooth value noise came third and still gridded — its lattice points sit
    // on a regular grid, and at four texels a cell the eye reads the arrangement
    // straight through the interpolation.
    //
    // The fix is frequency, not smoothness: cells tens of texels across read as
    // mottling and have no visible arrangement. Fine detail is the moss clumps'
    // and the normal map's job.
    const grain = periodicNoise(S, { waves: 18, maxCycles: 46, seed: 7717, falloff: 0.9 })
    const img = ctx.getImageData(0, 0, S, S)
    const gd = img.data
    for (let i = 0, p = 0; i < grain.length; i++, p += 4) {
      const n = grain[i] * 26
      gd[p] = Math.max(0, Math.min(255, gd[p] + n))
      gd[p + 1] = Math.max(0, Math.min(255, gd[p + 1] + n))
      gd[p + 2] = Math.max(0, Math.min(255, gd[p + 2] + n))
    }
    ctx.putImageData(img, 0, 0)

    // Hairline cracks in the jade.
    ctx.strokeStyle = `rgba(${dr},${dg},${db},0.34)`
    ctx.lineWidth = 1.4
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * S
      const y = Math.random() * S
      let a = Math.random() * Math.PI * 2
      wrapped(ctx, S, (k) => {
        k.beginPath()
        k.moveTo(x, y)
        let cx = x
        let cy = y
        let ang = a
        for (let s = 0; s < 14; s++) {
          ang += (Math.random() - 0.5) * 0.9
          cx += Math.cos(ang) * 18
          cy += Math.sin(ang) * 18
          k.lineTo(cx, cy)
        }
        k.stroke()
      })
      a += 1
    }

    // A 문양 lattice used to be drawn here on a fixed S/8 diagonal step. It was
    // meant to read as inlay, but a regular geometric grid tiled across the
    // whole plateau is a grid however faint it is, and it was a real part of the
    // graph-paper look over the arena. Broad variation comes from the tonal
    // patches above instead.

    // Glowing veins, for stages whose ground is cracked open onto something hot.
    // This is how 적염비경 gets its fire back after the albedo was desaturated
    // to stop it swallowing the creatures standing on it: light from the floor,
    // in thin lines that cover very little of it.
    if (veinHex) {
      const [vr, vg, vb] = rgb(veinHex)
      for (let pass = 0; pass < 2; pass++) {
        // Wide soft halo first, then a hot thin core inside it.
        ctx.strokeStyle = pass === 0
          ? `rgba(${vr},${vg},${vb},0.16)`
          : `rgba(255,${Math.min(255, vg + 90)},${Math.min(255, vb + 70)},0.85)`
        ctx.lineWidth = pass === 0 ? 11 : 2.4
        ctx.lineCap = 'round'
        let seed = 20240719
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
        for (let i = 0; i < 14; i++) {
          const x = rnd() * S
          const y = rnd() * S
          let ang = rnd() * Math.PI * 2
          wrapped(ctx, S, (k) => {
            k.beginPath()
            k.moveTo(x, y)
            let cx = x
            let cy = y
            for (let s = 0; s < 16; s++) {
              ang += (rnd() - 0.5) * 1.1
              cx += Math.cos(ang) * 22
              cy += Math.sin(ang) * 22
              k.lineTo(cx, cy)
            }
            k.stroke()
          })
        }
      }
    }

    // Matches the normal map's repeat. Two different tiling rates over the same
    // surface beat against each other and produce a third, coarser pattern.
    return finish(c, { repeat: 9 })
  })
}

/**
 * Normal map matching the ground, derived from a height field.
 *
 * This is what actually makes the surface catch the light — without it the
 * ground is a painted plane no matter how detailed the albedo is.
 */
export function groundNormalTexture() {
  return cached('groundNormal', () => {
    const S = 512
    const height = new Float32Array(S * S)

    // Periodic noise rather than octaves of value noise. The lattice of a value
    // noise is visible as a grid in a normal map at any cell size — see the note
    // on periodicNoise above.
    height.set(periodicNoise(S, { waves: 16, maxCycles: 26, seed: 4423, falloff: 0.85 }))

    const c = canvas(S)
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(S, S)
    const at = (x, y) => height[((y + S) % S) * S + ((x + S) % S)]
    const strength = 2.6
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength
        const dy = (at(x, y + 1) - at(x, y - 1)) * strength
        // Normalise (-dx, -dy, 1) into 0..255 tangent-space encoding.
        const len = Math.hypot(dx, dy, 1)
        const i = (y * S + x) * 4
        img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
        img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
        img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)

    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(9, 9)
    tex.anisotropy = 16
    tex.needsUpdate = true
    return tex
  })
}

/** Hexagonal 결계 barrier pattern, additive. */
export function barrierTexture() {
  return cached('barrier', () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, S, S)

    ctx.strokeStyle = 'rgba(150,230,255,0.85)'
    ctx.lineWidth = 2
    const r = S / 8
    const h = r * Math.sqrt(3)
    for (let row = -1; row < 6; row++) {
      for (let col = -1; col < 6; col++) {
        const cx = col * r * 1.5
        const cy = row * h + (col % 2 ? h / 2 : 0)
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i
          const px = cx + Math.cos(a) * r * 0.92
          const py = cy + Math.sin(a) * r * 0.92
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.stroke()
      }
    }
    // Fade the top so the wall reads as a curtain rising from the ground and
    // dissolving into the sky, rather than a hard-edged box.
    const fade = ctx.createLinearGradient(0, 0, 0, S)
    fade.addColorStop(0, 'rgba(0,0,0,1)')
    fade.addColorStop(0.45, 'rgba(0,0,0,0.55)')
    fade.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = fade
    ctx.fillRect(0, 0, S, S)

    return finish(c, { repeat: 1, srgb: true })
  })
}

/** A soft radial blob — the workhorse for glows, sparks, and mist. */
export function glowTexture() {
  return cached('glow', () => {
    const S = 128
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    return finish(c)
  })
}

/** 팔괘 (eight trigrams) ring, used for the player formation and 팔괘진. */
export function baguaTexture() {
  return cached('bagua', () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const cx = S / 2
    const cy = S / 2

    ctx.strokeStyle = 'rgba(200,240,255,0.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, S * 0.46, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, S * 0.30, 0, Math.PI * 2)
    ctx.stroke()

    // Eight trigrams: three bars each, some broken. The pattern is the real 팔괘.
    const TRIGRAMS = [
      [1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1],
      [1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0],
    ]
    ctx.strokeStyle = 'rgba(232,197,106,0.95)'
    ctx.lineWidth = 4
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 2
      ctx.save()
      ctx.translate(cx + Math.cos(a) * S * 0.385, cy + Math.sin(a) * S * 0.385)
      ctx.rotate(a + Math.PI / 2)
      const bars = TRIGRAMS[i]
      for (let b = 0; b < 3; b++) {
        const y = (b - 1) * 9
        const half = 15
        ctx.beginPath()
        if (bars[b]) {
          ctx.moveTo(-half, y)
          ctx.lineTo(half, y)
        } else {
          ctx.moveTo(-half, y)
          ctx.lineTo(-4, y)
          ctx.moveTo(4, y)
          ctx.lineTo(half, y)
        }
        ctx.stroke()
      }
      ctx.restore()
    }

    return finish(c)
  })
}

/** A single flower petal, for the ambient drift. */
export function petalTexture() {
  return cached('petal', () => {
    const S = 64
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, 'rgba(255,225,240,0.95)')
    g.addColorStop(1, 'rgba(255,160,200,0.35)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(S / 2, 4)
    ctx.bezierCurveTo(S - 6, S * 0.3, S - 10, S * 0.8, S / 2, S - 4)
    ctx.bezierCurveTo(10, S * 0.8, 6, S * 0.3, S / 2, 4)
    ctx.fill()
    return finish(c)
  })
}

/**
 * A soft round mote with a hot core — an ember on 적염비경, a snowflake on
 * 한천비경. White, so the stage tint decides which it is.
 */
export function moteTexture() {
  return cached('mote', () => {
    const S = 64
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0.0, 'rgba(255,255,255,1)')
    g.addColorStop(0.3, 'rgba(255,255,255,0.72)')
    g.addColorStop(0.65, 'rgba(255,255,255,0.22)')
    g.addColorStop(1.0, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2)
    ctx.fill()
    return finish(c)
  })
}

/** Low-frequency mist, scrolled across a ground-hugging plane. */
export function mistTexture() {
  return cached('mist', () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, S, S)
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * S
      const y = Math.random() * S
      const r = 30 + Math.random() * 70
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(200,230,245,0.10)')
      g.addColorStop(1, 'rgba(200,230,245,0)')
      ctx.fillStyle = g
      for (const dx of [-S, 0, S]) {
        for (const dy of [-S, 0, S]) {
          ctx.save()
          ctx.translate(dx, dy)
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }
    }
    return finish(c, { repeat: 3 })
  })
}

/** Large hand-laid stone slabs for the playable shrine centre. */
export function shrineTexture(baseHex = 0x3d5d54, groutHex = 0x1d302d, accentHex = 0x8fd8ff) {
  return cached(`shrine${baseHex}${groutHex}${accentHex}`, () => {
    const S = 512
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const hex = (n) => `#${n.toString(16).padStart(6, '0')}`
    const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    const [ar, ag, ab] = rgb(accentHex)

    ctx.fillStyle = hex(baseHex)
    ctx.fillRect(0, 0, S, S)
    ctx.lineJoin = 'round'

    // Concentric cuts echo the physical shrine rings, but every slab has a
    // slightly different angle and radius so the pattern does not become a
    // perfect procedural target.
    const cx = S / 2
    const cy = S / 2
    const rings = [36, 82, 132, 190, 252]
    for (let r = 0; r < rings.length - 1; r++) {
      const inner = rings[r]
      const outer = rings[r + 1]
      const count = 10 + r * 2
      for (let i = 0; i < count; i++) {
        const a0 = (i / count) * Math.PI * 2 + (r % 2) * 0.08
        const a1 = ((i + 0.96) / count) * Math.PI * 2 + (r % 2) * 0.08
        const wobble = 1 + Math.sin(i * 7.3 + r * 3.1) * 0.035
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a0) * inner * wobble, cy + Math.sin(a0) * inner * wobble)
        ctx.lineTo(cx + Math.cos(a1) * inner * wobble, cy + Math.sin(a1) * inner * wobble)
        ctx.lineTo(cx + Math.cos(a1) * outer * wobble, cy + Math.sin(a1) * outer * wobble)
        ctx.lineTo(cx + Math.cos(a0) * outer * wobble, cy + Math.sin(a0) * outer * wobble)
        ctx.closePath()
        const light = 0.82 + ((i + r) % 3) * 0.07
        const [br, bg, bb] = rgb(baseHex)
        ctx.fillStyle = `rgb(${Math.min(255, Math.round(br * light))},${Math.min(255, Math.round(bg * light))},${Math.min(255, Math.round(bb * light))})`
        ctx.fill()
        ctx.strokeStyle = hex(groutHex)
        ctx.lineWidth = 3.2
        ctx.stroke()
      }
    }

    // A few restrained spirit-inlay marks keep the focal surface connected to
    // the jade magic without turning the entire floor into a light source.
    ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.28)`
    ctx.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      const x = cx + Math.sin(a) * 112
      const y = cy + Math.cos(a) * 112
      ctx.beginPath()
      ctx.moveTo(x - Math.cos(a) * 13, y + Math.sin(a) * 13)
      ctx.lineTo(x + Math.cos(a) * 13, y - Math.sin(a) * 13)
      ctx.stroke()
    }

    return finish(c, { repeat: 1 })
  })
}
