const SAMPLES = 30

/** F3 overlay. Hidden by default and does no work while hidden. */
export class DebugOverlay {
  constructor(root) {
    this.enabled = true
    this.node = null
    this.frames = this.enabled ? new Float32Array(SAMPLES) : null
    this.cursor = 0
    this.visible = false
    if (!this.enabled) return
    this.node = document.createElement('div')
    this.node.className = 'debug-overlay'
    Object.assign(this.node.style, {
      display: 'none',
      position: 'absolute',
      top: '8px',
      right: '8px',
      zIndex: '60',
      padding: '8px',
      color: '#f5ead1',
      background: 'rgba(19,18,15,.88)',
      font: '10px/1.5 ui-monospace, Consolas, monospace',
      whiteSpace: 'pre',
    })
    root.appendChild(this.node)
  }

  toggle() {
    if (!this.enabled) return
    this.visible = !this.visible
    this.node.style.display = this.visible ? '' : 'none'
  }

  update(s) {
    if (!this.enabled) return
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
    this.node?.remove()
  }
}
