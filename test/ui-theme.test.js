import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../styles/ink-ui.css', import.meta.url)), 'utf8')
const index = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8')
const titleScreen = readFileSync(fileURLToPath(new URL('../src/ui/TitleScreen.js', import.meta.url)), 'utf8')
const shopScreen = readFileSync(fileURLToPath(new URL('../src/ui/ShopScreen.js', import.meta.url)), 'utf8')
const codexScreen = readFileSync(fileURLToPath(new URL('../src/ui/CodexScreen.js', import.meta.url)), 'utf8')
const resultScreen = readFileSync(fileURLToPath(new URL('../src/ui/ResultScreen.js', import.meta.url)), 'utf8')

describe('single ink-jade visual language', () => {
  it('defines one shared realm palette for loader, title, scrolls and combat HUD', () => {
    expect(css).toMatch(/--jade-deep:\s*#173b3c/)
    expect(css).toMatch(/--realm-night:\s*#0b1b20/)
    expect(css).toMatch(/--realm-image-grade:\s*grayscale\(\.18\) sepia\(\.10\) saturate\(\.86\) contrast\(1\.08\)/)
    expect(css).toMatch(/\.hud-slot-icon[^}]*filter:\s*var\(--realm-image-grade\)/s)
    expect(css).toMatch(/--paper-deep:\s*#b6a98e/)
    expect(css).toMatch(/\.title-menu \.title-enter\s*\{[^}]*var\(--cinnabar-dark\)/s)
    expect(css).toMatch(/\.modal-panel\s*\{[^}]*border-block:\s*4px solid var\(--jade-deep\)/s)
  })

  it('keeps the loader as a transition instead of a second marketing title', () => {
    const boot = index.match(/<div id="boot-shell"[\s\S]*?<\/div>\s*<canvas id="scene"/)?.[0] ?? ''
    expect(boot).toContain('비경을 준비합니다')
    expect(boot).not.toContain('영허 검가')
  })

  it('uses the same jade-ink overlay for every stage and confirm view', () => {
    expect(titleScreen).toContain('rgba(23, 59, 60, 0.08)')
    expect(titleScreen).toContain('rgba(11, 27, 32, 0.90)')
    expect(titleScreen).toContain('rgba(11, 27, 32, 0.54)')
    expect(titleScreen).not.toContain('rgba(5, 20, 27, 0.06)')
    expect(titleScreen).not.toContain('rgba(8, 23, 43, 0.04)')
  })

  it('keeps every non-combat surface on the same dark realm substrate', () => {
    expect(css).toMatch(/\.screen-inner\s*\{[\s\S]*var\(--realm-panel\)/)
    expect(css).toMatch(/\.result-screen\s*\{[\s\S]*rgba\(5,17,21,.96\)/)
    expect(css).toMatch(/\.modal-panel\s*\{[\s\S]*var\(--realm-panel\)/)
    expect(css).toMatch(/\.pause-screen\s*\{\s*background:\s*rgba\(5, 17, 21, \.78\)/)
    expect(css).not.toMatch(/\.result-screen\s*\{[\s\S]*rgba\(232,224,204/)
    expect(css).not.toMatch(/\.modal-panel\s*\{[\s\S]*var\(--paper\)/)
  })

  it('keeps the result ledger inside one game viewport instead of a scrolling web document', () => {
    expect(css).toMatch(/\.result-screen \.screen-inner\s*\{[^}]*grid-template-rows:\s*auto auto auto[^}]*height:\s*auto[^}]*max-height:\s*calc\(100dvh - clamp\(18px, 4vh, 48px\)\)[^}]*overflow:\s*hidden/s)
    expect(css).toMatch(/\.result-ledger\s*\{[^}]*grid-template-columns:\s*minmax\(0, \.94fr\) minmax\(0, 1\.06fr\)/s)
    expect(css).toMatch(/\.result-ledger-has-progress\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.02fr\) minmax\(0, \.94fr\) minmax\(0, 1\.04fr\)/s)
    expect(css).toMatch(/\.result-progress-column\s*\{[^}]*align-content:\s*start/s)
    expect(css).not.toMatch(/\.result-screen \.screen-inner\s*\{[^}]*overflow-y:\s*auto/s)
    expect(resultScreen).toContain('result-progress-column')
    expect(resultScreen).toContain('result-ledger-has-progress')
  })

  it('keeps result layout contracts explicit across the review viewports', () => {
    // 1280x720: compact media keeps any optional progress row inside the same viewport.
    expect(css).toMatch(/@media \(min-width: 761px\) and \(max-height: 760px\)[\s\S]*?\.result-screen \.screen-inner \{[^}]*max-height:\s*calc\(100dvh - 18px\)/s)
    expect(css).toMatch(/\.result-ledger-has-progress \{[^}]*grid-template-columns:\s*minmax\(0, 1\.02fr\) minmax\(0, \.98fr\)/s)

    // 1920x1080: the natural-height two-column ledger is the default contract.
    expect(css).toMatch(/\.result-screen \.screen-inner\s*\{[^}]*width:\s*min\(1240px, 94vw\)[^}]*height:\s*auto/s)
    expect(css).toMatch(/\.result-ledger\s*\{[^}]*grid-template-columns:\s*minmax\(0, \.94fr\) minmax\(0, 1\.06fr\)/s)

    // 2560x1600: preserve a bounded, centered result panel instead of full-screen ink.
    expect(css).toMatch(/@media \(min-width: 2200px\) and \(min-height: 1200px\)[\s\S]*?\.result-screen \.screen-inner \{ width:\s*min\(1400px, 92vw\)/s)
  })

  it('keeps dantian and codex as bounded category ledgers instead of stacked web pages', () => {
    expect(shopScreen).toContain('role="tablist" aria-label="단전 수련 분류"')
    expect(shopScreen).toContain('data-shop-pane="cultivation"')
    expect(shopScreen).toContain('data-shop-pane="affinity"')
    expect(codexScreen).toContain('role="tablist" aria-label="도감 분류"')
    for (const kind of ['weapons', 'enemies', 'bosses', 'achievements', 'records']) {
      expect(codexScreen).toContain(`data-codex-pane="${kind}"`)
    }
    expect(css).toMatch(/\.shop-inner\s*\{[^}]*height:\s*min\(820px, calc\(100dvh - 40px\)\)[^}]*overflow:\s*hidden/s)
    expect(css).toMatch(/\.shop-scroll\s*\{[^}]*overflow:\s*hidden/s)
    expect(css).toMatch(/\.shop-grid\s*\{[^}]*repeat\(3, minmax\(0,1fr\)\)/s)
    expect(css).toMatch(/\.codex-achievements\s*\{[^}]*repeat\(3, minmax\(0, 1fr\)\)/s)
  })
})
