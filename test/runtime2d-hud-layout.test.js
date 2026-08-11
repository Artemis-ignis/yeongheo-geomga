import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cssPath = fileURLToPath(new URL('../styles/hud.css', import.meta.url))
const css = readFileSync(cssPath, 'utf8')

describe('2D HUD overlay layout contract', () => {
  it('defines the shared boss stack offset on the common HUD ancestor', () => {
    expect(css).toMatch(/#hud\s*\{[^}]*--boss-top:/s)
  })

  it('keeps root-level cast and runtime banners out of the viewport origin', () => {
    expect(css).toMatch(/\.hud-boss-cast\s*\{[^}]*top:\s*calc\(var\(--boss-top,\s*clamp\(/s)
    expect(css).toMatch(/\.runtime2d-banner\s*\{[^}]*top:\s*calc\(var\(--boss-top,\s*clamp\(/s)
  })

  it('keeps combat notices behind player-decision modals', () => {
    expect(css).toMatch(/\.runtime2d-banner\s*\{[^}]*z-index:\s*9\s*;/s)
    expect(css).toMatch(/\.modal-backdrop\s*\{[^}]*z-index:\s*10\s*;/s)
  })
})
