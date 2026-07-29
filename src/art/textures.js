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

    // Fine speckle — the detail that survives close-up.
    const img = ctx.getImageData(0, 0, S, S)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 26
      d[i] = Math.max(0, Math.min(255, d[i] + n))
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
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

    // Sum a few octaves of value noise, sampled on a wrapping lattice.
    const lattice = (period) => {
      const grid = new Float32Array(period * period)
      for (let i = 0; i < grid.length; i++) grid[i] = Math.random()
      return (x, y) => {
        const fx = (x / S) * period
        const fy = (y / S) * period
        const x0 = Math.floor(fx) % period
        const y0 = Math.floor(fy) % period
        const x1 = (x0 + 1) % period
        const y1 = (y0 + 1) % period
        const tx = fx - Math.floor(fx)
        const ty = fy - Math.floor(fy)
        const sx = tx * tx * (3 - 2 * tx)
        const sy = ty * ty * (3 - 2 * ty)
        const a = grid[y0 * period + x0] + (grid[y0 * period + x1] - grid[y0 * period + x0]) * sx
        const b = grid[y1 * period + x0] + (grid[y1 * period + x1] - grid[y1 * period + x0]) * sx
        return a + (b - a) * sy
      }
    }
    // Deliberately no low octaves. This map is repeated many times across the
    // plateau, and any large-scale structure in it repeats with it — an 8-period
    // octave tiled 14 times painted a visible grid over the whole arena. Broad
    // tonal variation is the albedo's job, which is mapped once and never tiles;
    // the normal map only has to supply the fine grain that catches light.
    const octaves = [[24, 0.34], [48, 0.26], [96, 0.16], [192, 0.09]]
    const samplers = octaves.map(([p]) => lattice(p))
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let h = 0
        for (let o = 0; o < octaves.length; o++) h += samplers[o](x, y) * octaves[o][1]
        height[y * S + x] = h
      }
    }

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
    tex.anisotropy = 8
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
