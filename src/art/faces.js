import * as THREE from 'three'

/**
 * Canvas-drawn anime faces.
 *
 * The head is a low-poly sphere; all of the character's readability comes from
 * this texture, so it is drawn large (512px) and viewed at gameplay distance.
 * Everything is plain Canvas2D — the game ships no image files.
 */

const SIZE = 512
const cache = new Map()

function hex(n) {
  return `#${n.toString(16).padStart(6, '0')}`
}

/** Left/right mirrored draw, so the two eyes always match. */
function bothEyes(ctx, draw) {
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(SIZE / 2 + side * 104, SIZE / 2 + 26)
    ctx.scale(side, 1)
    draw(ctx)
    ctx.restore()
  }
}

function drawBrows(ctx, tilt, color) {
  bothEyes(ctx, (c) => {
    c.strokeStyle = color
    c.lineWidth = 9
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(-52, -104 + tilt)
    c.quadraticCurveTo(-6, -122, 44, -100 - tilt)
    c.stroke()
  })
}

function drawOpenEye(ctx, palette, { wide = 1, highlight = 1 } = {}) {
  bothEyes(ctx, (c) => {
    // Deliberately oversized: at the gameplay camera the head is only ~40px tall,
    // and anything smaller stops reading as a face.
    const w = 68
    const h = 80 * wide

    // Eye white.
    c.fillStyle = '#ffffff'
    c.beginPath()
    c.ellipse(0, 0, w, h, 0, 0, Math.PI * 2)
    c.fill()

    // Iris with a vertical gradient, darker at the top.
    const g = c.createLinearGradient(0, -h, 0, h)
    g.addColorStop(0, '#1b2a3a')
    g.addColorStop(0.45, hex(palette.eye))
    g.addColorStop(1, '#ffffff')
    c.fillStyle = g
    c.beginPath()
    c.ellipse(0, 4, w * 0.82, h * 0.86, 0, 0, Math.PI * 2)
    c.fill()

    // Pupil.
    c.fillStyle = 'rgba(15,18,28,0.85)'
    c.beginPath()
    c.ellipse(0, 6, w * 0.42, h * 0.5, 0, 0, Math.PI * 2)
    c.fill()

    // Specular highlights — the single biggest cue that reads as "anime eye".
    c.fillStyle = '#ffffff'
    c.globalAlpha = highlight
    c.beginPath()
    c.ellipse(-21, -31, 22, 27, -0.3, 0, Math.PI * 2)
    c.fill()
    c.beginPath()
    c.ellipse(24, 34, 11, 12, 0, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 1

    // Heavy upper lash, thickening toward the outer corner.
    c.strokeStyle = '#14161f'
    c.lineCap = 'round'
    c.lineWidth = 13
    c.beginPath()
    c.ellipse(0, 0, w, h, 0, Math.PI * 1.08, Math.PI * 1.92)
    c.stroke()
    c.lineWidth = 20
    c.beginPath()
    c.moveTo(-w * 0.98, -h * 0.12)
    c.quadraticCurveTo(-w * 1.15, -h * 0.5, -w * 1.24, -h * 0.72)
    c.stroke()

    // Thin lower lid.
    c.lineWidth = 5
    c.strokeStyle = 'rgba(20,22,31,0.55)'
    c.beginPath()
    c.ellipse(0, 2, w * 0.92, h * 0.92, 0, Math.PI * 0.18, Math.PI * 0.8)
    c.stroke()
  })
}

function drawClosedEye(ctx) {
  bothEyes(ctx, (c) => {
    c.strokeStyle = '#14161f'
    c.lineWidth = 12
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(-48, -6)
    c.quadraticCurveTo(0, 34, 48, -10)
    c.stroke()
  })
}

function drawBlush(ctx) {
  for (const side of [-1, 1]) {
    const x = SIZE / 2 + side * 158
    const y = SIZE / 2 + 108
    const g = ctx.createRadialGradient(x, y, 0, x, y, 58)
    g.addColorStop(0, 'rgba(255,120,140,0.42)')
    g.addColorStop(1, 'rgba(255,120,140,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(x, y, 58, 34, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawMouth(ctx, kind) {
  const x = SIZE / 2
  const y = SIZE / 2 + 152
  ctx.strokeStyle = '#8c3a44'
  ctx.fillStyle = '#a8434f'
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (kind === 'open') {
    ctx.ellipse(x, y + 6, 26, 31, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'smile') {
    ctx.moveTo(x - 34, y - 8)
    ctx.quadraticCurveTo(x, y + 30, x + 34, y - 8)
    ctx.stroke()
  } else {
    ctx.moveTo(x - 21, y)
    ctx.quadraticCurveTo(x, y + 18, x + 21, y)
    ctx.stroke()
  }
}

function buildFace(palette, expression) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, SIZE, SIZE)

  if (expression === 'hurt') {
    drawBrows(ctx, 14, '#2b1f27')
    drawClosedEye(ctx)
    drawBlush(ctx)
    drawMouth(ctx, 'open')
  } else if (expression === 'breakthrough') {
    drawBrows(ctx, -8, '#2b1f27')
    drawOpenEye(ctx, palette, { wide: 1.12, highlight: 1 })
    // Extra glint ring — reads as 기(氣) surging at 돌파.
    bothEyes(ctx, (c) => {
      c.strokeStyle = 'rgba(255,255,255,0.85)'
      c.lineWidth = 4
      c.beginPath()
      c.ellipse(0, 4, 34, 40, 0, 0, Math.PI * 2)
      c.stroke()
    })
    drawBlush(ctx)
    drawMouth(ctx, 'smile')
  } else {
    drawBrows(ctx, 0, '#2b1f27')
    drawOpenEye(ctx, palette)
    drawBlush(ctx)
    drawMouth(ctx, 'neutral')
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

/** All three expressions for one character, built once and cached by palette. */
export function faceSet(palette) {
  const key = `${palette.eye}`
  let set = cache.get(key)
  if (set === undefined) {
    set = {
      idle: buildFace(palette, 'idle'),
      hurt: buildFace(palette, 'hurt'),
      breakthrough: buildFace(palette, 'breakthrough'),
    }
    cache.set(key, set)
  }
  return set
}

export function makeFaceTexture(palette, expression) {
  return faceSet(palette)[expression] ?? faceSet(palette).idle
}
