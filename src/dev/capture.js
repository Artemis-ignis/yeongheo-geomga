/**
 * Dev-only frame capture.
 *
 * The dev harness may run without a composited browser window, which makes normal
 * screenshots impossible and leaves `innerWidth`/`innerHeight` at 0. This installs
 * `window.__capture(name, width, height)`, which forces the renderer to a known
 * size, draws one frame, and POSTs the PNG to the Vite dev server (see the
 * `screenshot-sink` plugin in vite.config.js), which writes it to `.shots/`.
 *
 * `drawFrame(width, height)` must synchronously render one complete frame —
 * `toDataURL` reads the drawing buffer, which is only valid immediately after a draw.
 *
 * Never imported by the production build.
 */
/**
 * Dev-only manual stepper.
 *
 * A tab that is not being composited never fires requestAnimationFrame, so the
 * simulation would sit frozen at its initial state. This exposes
 * `window.__step(seconds)` to advance the simulation deterministically in fixed
 * slices — which is also more precise for verification than waiting on wall time.
 */
export function installStepper(update, fixedDt) {
  if (typeof window === 'undefined') return
  window.__step = (seconds = 1) => {
    const ticks = Math.max(1, Math.round(seconds / fixedDt))
    for (let i = 0; i < ticks; i++) update(fixedDt)
    return ticks
  }
}

export function installCapture(renderer, drawFrame) {
  if (typeof window === 'undefined') return

  window.__capture = async (name = 'shot', width = 1280, height = 720) => {
    // getSize reports CSS pixels, which is what setSize expects back. It writes
    // through Vector2#set, so the target needs that method.
    const prev = renderer.getSize({ x: 0, y: 0, set(x, y) { this.x = x; this.y = y; return this } })
    const prevRatio = renderer.getPixelRatio()

    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    drawFrame(width, height)
    // Post-processing renders into its own target; draw twice so the composer's
    // final blit lands in the visible buffer before it is read back.
    drawFrame(width, height)
    const dataUrl = renderer.domElement.toDataURL('image/png')

    renderer.setPixelRatio(prevRatio)
    renderer.setSize(prev.x, prev.y, false)

    const response = await fetch('/__shot', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: `${name}\n${dataUrl}`,
    })
    return response.text()
  }
}
