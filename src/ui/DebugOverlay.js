const SAMPLES = 30

/** F3 overlay. Hidden by default and does no work while hidden. */
export class DebugOverlay {
  constructor(root) {
    this.node = document.createElement('div')
    this.node.className = 'debug-overlay'
    this.node.style.display = 'none'
    root.appendChild(this.node)
    this.frames = new Float32Array(SAMPLES)
    this.cursor = 0
    this.visible = false
  }

  toggle() {
    this.visible = !this.visible
    this.node.style.display = this.visible ? '' : 'none'
  }

  update(s) {
    // Keep the rolling average warm even while hidden, so toggling it on shows a
    // real number instead of a spike.
    this.frames[this.cursor % SAMPLES] = s.dt
    this.cursor++
    if (!this.visible) return

    let total = 0
    const n = Math.min(SAMPLES, this.cursor)
    for (let i = 0; i < n; i++) total += this.frames[i]
    const avg = total / Math.max(1, n)

    this.node.textContent = [
      `fps      ${(1 / Math.max(avg, 1e-6)).toFixed(0)}  (${(avg * 1000).toFixed(1)} ms)`,
      `work     ${(s.workMs ?? 0).toFixed(1)} ms`,
      `sim/draw ${(s.simMs ?? 0).toFixed(1)} / ${(s.drawMs ?? 0).toFixed(1)} ms`,
      `state    ${s.state}`,
      `draws    ${s.drawCalls}`,
      `tris     ${s.triangles}`,
      `enemies  ${s.enemies}`,
      `projs    ${s.projectiles}`,
      `pickups  ${s.pickups}`,
      `dropped  ${s.dropped}`,
      `res      ${(s.scale ?? 1).toFixed(2)}x`,
      `backend  ${s.backend ?? 'unknown'}`,
      `warmup   ${(s.shaderWarmupMs ?? 0).toFixed(1)} ms`,
      `seed     ${s.seed}`,
    ].join('\n')
  }

  dispose() {
    this.node.remove()
  }
}
