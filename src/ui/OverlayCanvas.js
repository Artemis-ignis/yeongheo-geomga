import * as THREE from 'three'

const MAX_TEXTS = 120
const RISE = 46
const LIFE = 0.8

const _v = new THREE.Vector3()

/**
 * Floating combat text on a single 2D canvas above the WebGL view.
 *
 * Deliberately not DOM: hundreds of hits per second would mean hundreds of node
 * insertions and removals per second. World positions are projected once at push
 * time and the text then rises in screen space, which is cheaper and steadier
 * than re-projecting a moving anchor every frame.
 */
export class OverlayCanvas {
  constructor(canvas, camera) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.camera = camera
    this.dpr = 1

    this.x = new Float32Array(MAX_TEXTS)
    this.y = new Float32Array(MAX_TEXTS)
    this.life = new Float32Array(MAX_TEXTS)
    this.crit = new Uint8Array(MAX_TEXTS)
    this.text = new Array(MAX_TEXTS).fill('')
    this.next = 0
    this.liveCount = 0

    this.banner = ''
    this.bannerLife = 0
  }

  resize(width, height, dpr) {
    this.dpr = dpr
  }

  pushText(wx, wy, wz, value, crit) {
    _v.set(wx, wy, wz).project(this.camera)
    // Behind the camera — projection wraps, so drop it rather than draw a ghost.
    if (_v.z > 1) return
    const i = this.next % MAX_TEXTS
    this.next++
    this.x[i] = (_v.x * 0.5 + 0.5) * this.canvas.clientWidth
    this.y[i] = (-_v.y * 0.5 + 0.5) * this.canvas.clientHeight
    this.life[i] = LIFE
    this.crit[i] = crit ? 1 : 0
    this.text[i] = String(value)
  }

  pushBanner(text, seconds = 2.6) {
    this.banner = text
    this.bannerLife = seconds
  }

  render(dt) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    let live = 0
    for (let i = 0; i < MAX_TEXTS; i++) if (this.life[i] > 0) live++
    this.liveCount = live
    if (live === 0 && this.bannerLife <= 0) {
      if (this._dirty) { ctx.clearRect(0, 0, w, h); this._dirty = false }
      return
    }
    this._dirty = true

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.scale(this.dpr, this.dpr)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'

    // Two passes so the font is set twice per frame, not once per number.
    for (let pass = 0; pass < 2; pass++) {
      const wantCrit = pass === 1
      ctx.font = wantCrit
        ? '700 26px "Noto Sans KR", "Malgun Gothic", sans-serif'
        : '600 18px "Noto Sans KR", "Malgun Gothic", sans-serif'
      ctx.lineWidth = wantCrit ? 5 : 4
      ctx.strokeStyle = 'rgba(8,12,18,0.85)'

      for (let i = 0; i < MAX_TEXTS; i++) {
        if (this.life[i] <= 0) continue
        if ((this.crit[i] === 1) !== wantCrit) continue
        const t = 1 - this.life[i] / LIFE
        const alpha = this.life[i] < 0.25 ? this.life[i] / 0.25 : 1
        const y = this.y[i] - t * RISE
        ctx.globalAlpha = alpha
        ctx.strokeText(this.text[i], this.x[i], y)
        ctx.fillStyle = wantCrit ? '#ffd76a' : '#ffffff'
        ctx.fillText(this.text[i], this.x[i], y)
      }
    }

    for (let i = 0; i < MAX_TEXTS; i++) if (this.life[i] > 0) this.life[i] -= dt

    if (this.bannerLife > 0) {
      this.bannerLife -= dt
      const cw = this.canvas.clientWidth
      const cy = this.canvas.clientHeight * 0.24
      const fade = Math.min(1, this.bannerLife / 0.5)
      ctx.globalAlpha = fade
      ctx.fillStyle = 'rgba(120,20,30,0.55)'
      ctx.fillRect(0, cy - 34, cw, 68)
      ctx.font = '700 34px "Noto Sans KR", "Malgun Gothic", sans-serif'
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(8,12,18,0.9)'
      ctx.strokeText(this.banner, cw / 2, cy)
      ctx.fillStyle = '#ffd0d0'
      ctx.fillText(this.banner, cw / 2, cy)
    }

    ctx.globalAlpha = 1
  }

  clear() {
    this.life.fill(0)
    this.bannerLife = 0
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}
