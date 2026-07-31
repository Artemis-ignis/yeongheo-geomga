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
/**
 * A warning for anyone reading a captured frame.
 *
 * `__capture` draws whatever the scene currently holds, and a scene that has
 * stopped being stepped is not a scene a player ever sees. `Vfx` ages its
 * instances from a `uTime` uniform that only advances while the game updates,
 * and every effect grows with age — so a frame taken after stepping has stopped
 * shows every live effect frozen at whatever size it had reached, none of them
 * expiring, all of them additive.
 *
 * That produced a white mass covering a quarter of the frame in a boss capture,
 * and I spent a long time hunting it through the boss, the sky, the terrain, the
 * 팔괘진 and the player before checking the same moment during live play, where
 * it does not exist. Capture *while* stepping, or capture a frame you have just
 * stepped into; a paused scene is an artefact, not a screenshot.
 */
export function installStepper(update, fixedDt) {
  if (typeof window === 'undefined') return
  window.__step = (seconds = 1) => {
    const ticks = Math.max(1, Math.round(seconds / fixedDt))
    for (let i = 0; i < ticks; i++) update(fixedDt)
    return ticks
  }
}

/**
 * Screenshot the DOM UI without the browser compositing the page.
 *
 * The HUD, menus, shop, codex and result screen are real DOM over the canvas,
 * and `renderer.domElement.toDataURL()` only ever sees WebGL — so in a harness
 * that cannot composite, every UI change I made was verified structurally and
 * never actually looked at. That blind spot is where I was wrong twice about
 * how something read.
 *
 * An SVG `foreignObject` renders arbitrary HTML into an image, and an image can
 * be drawn to a canvas and read back. It needs everything inlined: the
 * stylesheet is same-origin so its rules can be read out, and the item icons
 * are already canvas-generated data URLs, so nothing has to be fetched.
 */
export function installUICapture(hudRoot) {
  if (typeof window === 'undefined') return

  const collectCss = () => {
    let css = ''
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) css += `${rule.cssText}\n`
      } catch {
        // A cross-origin sheet cannot be read. We do not ship any.
      }
    }
    return css
  }

  /**
   * `selector` captures one element instead of the whole overlay. A clone does
   * not carry its source's scroll position, so anything below the fold of a
   * scrolling panel is otherwise unphotographable — which is exactly where the
   * codex keeps the creature list.
   */
  window.__captureUI = async (name = 'ui', width = 1400, height = 860, selector = null) => {
    const css = collectCss()

    // XMLSerializer, not innerHTML. A foreignObject is parsed as XML, and the
    // HTML serialisation leaves void elements like <img> unclosed, which makes
    // the whole SVG undecodable — the failure surfaces only as "the source
    // image cannot be decoded", with no hint that the markup is the cause.
    const host = document.createElementNS('http://www.w3.org/1999/xhtml', 'div')
    // Carry the inherited typography down explicitly. Rules written against
    // `body` do not match anything inside a foreignObject, so without this the
    // HUD renders in the default black serif and the capture lies about the
    // very thing it exists to show.
    const b = getComputedStyle(document.body)
    host.setAttribute('style',
      `width:${width}px;height:${height}px;position:relative;` +
      `color:${b.color};font-family:${b.fontFamily};font-size:${b.fontSize};` +
      'line-height:normal;-webkit-font-smoothing:antialiased')
    if (selector) {
      const target = document.querySelector(selector)
      if (!target) throw new Error(`nothing matches ${selector}`)
      host.appendChild(target.cloneNode(true))
    } else {
      for (const child of hudRoot.children) host.appendChild(child.cloneNode(true))
    }
    const markup = new XMLSerializer().serializeToString(host)

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject width="100%" height="100%">` +
      `<style xmlns="http://www.w3.org/1999/xhtml">/*<![CDATA[*/${css}/*]]>*/</style>` +
      `${markup}</foreignObject></svg>`

    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    const img = new Image()
    img.src = url
    await img.decode()

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    // A dark plate behind it, since the UI is transparent over the game.
    ctx.fillStyle = '#101820'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0)

    const response = await fetch('/__shot', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: `${name}\n${canvas.toDataURL('image/png')}`,
    })
    return response.text()
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
