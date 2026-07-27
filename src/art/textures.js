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

/** Jade ground: mottled base with a faint gold 문양 lattice. Tiles seamlessly. */
export function groundTexture() {
  return cached('ground', () => {
    const S = 512
    const c = canvas(S)
    const ctx = c.getContext('2d')

    ctx.fillStyle = '#2c5044'
    ctx.fillRect(0, 0, S, S)

    // Soft mottling. Wrapped draws keep the tile seamless.
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * S
      const y = Math.random() * S
      const r = 8 + Math.random() * 46
      const light = Math.random() > 0.5
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, light ? 'rgba(120,190,160,0.14)' : 'rgba(18,44,38,0.16)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
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

    // 문양 lattice — a diamond grid in faint gold.
    ctx.strokeStyle = 'rgba(232,197,106,0.10)'
    ctx.lineWidth = 1.5
    const step = S / 8
    ctx.beginPath()
    for (let i = -8; i <= 16; i++) {
      ctx.moveTo(i * step, 0)
      ctx.lineTo(i * step + S, S)
      ctx.moveTo(i * step, S)
      ctx.lineTo(i * step + S, 0)
    }
    ctx.stroke()

    return finish(c, { repeat: 12 })
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
