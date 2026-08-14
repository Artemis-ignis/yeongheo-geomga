import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cssPath = fileURLToPath(new URL('../styles/ink-ui.css', import.meta.url))
const css = readFileSync(cssPath, 'utf8')

describe('2D HUD overlay layout contract', () => {
  it('keeps the battlefield dominant by anchoring the main tool strip to the lower edge', () => {
    expect(css).toMatch(/\.hud-top\s*\{[^}]*bottom:\s*18px/s)
    expect(css).toMatch(/\.hud-vitals\s*\{[^}]*bottom:\s*18px/s)
    expect(css).toMatch(/\.hud-slots\s*\{[^}]*bottom:\s*18px/s)
  })

  it('keeps the boss and root-level cast information in a compact upper stack', () => {
    expect(css).toMatch(/\.hud-boss\s*\{[^}]*top:\s*18px/s)
    expect(css).toMatch(/\.hud-boss-cast-pixi\s*\{[^}]*position:\s*absolute[^}]*top:\s*58px/s)
    expect(css).toMatch(/\.runtime2d-banner\s*\{[^}]*top:\s*80px/s)
  })

  it('keeps combat notices behind player-decision modals', () => {
    expect(css).toMatch(/\.runtime2d-banner,[\s\S]*?\.hint-line\s*\{[^}]*z-index:\s*15\s*;/s)
    expect(css).toMatch(/\.modal-backdrop\s*\{[^}]*z-index:\s*30\s*;/s)
  })

  it('keeps the paused battlefield legible behind the paper breakthrough scroll', () => {
    expect(css).toMatch(/\.modal-backdrop\s*\{[^}]*rgba\(22,20,16,\.66\)/s)
    expect(css).toMatch(/backdrop-filter:\s*blur\(1\.4px\)\s+saturate\(\.86\)/)
    expect(css).toMatch(/\.modal-panel\s*\{[^}]*var\(--paper-texture\)[^}]*var\(--paper\)/s)
  })

  it('separates talisman choices from secondary control actions', () => {
    expect(css).toMatch(/\.modal-card\s*\{[^}]*clip-path:\s*polygon/s)
    expect(css).toMatch(/\.modal-action\s*\{[^}]*clip-path:\s*none/s)
    expect(css).toMatch(/\.modal-action-skip\s*\{[^}]*border-bottom/s)
  })
})
