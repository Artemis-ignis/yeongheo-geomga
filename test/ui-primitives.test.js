import { describe, expect, it } from 'vitest'
import {
  assetUrl,
  escapeHtml,
  focusElement,
  isButtonTarget,
  UI_DIRECTIONS,
} from '../src/ui/domPrimitives.js'
import { hudItemPresentation, itemPresentation } from '../src/ui/itemPresentation.js'

describe('shared UI primitives', () => {
  it('keeps the base URL and strips only leading asset slashes', () => {
    expect(assetUrl('/assets/ui/example.webp')).toBe('/assets/ui/example.webp')
  })

  it('escapes text for HTML attributes and markup', () => {
    expect(escapeHtml(`<a title="x">'&`)).toBe('&lt;a title=&quot;x&quot;&gt;&#39;&amp;')
  })

  it('keeps the shared keyboard and focus contracts', () => {
    expect(UI_DIRECTIONS.get('ArrowLeft')).toBe(-1)
    expect(UI_DIRECTIONS.get('KeyD')).toBe(1)

    const focused = []
    focusElement({ focus(options) { focused.push(options) } })
    expect(focused).toEqual([{ preventScroll: true }])

    expect(isButtonTarget({ tagName: 'BUTTON' })).toBe(true)
    expect(isButtonTarget({ tagName: 'DIV', getAttribute: () => 'button' })).toBe(true)
    expect(isButtonTarget({ tagName: 'DIV', getAttribute: () => null })).toBe(false)
  })
})

describe('shared item presentation', () => {
  it('matches the result loadout contract, including evolution and accessible copy', () => {
    const presentation = itemPresentation({ id: 'flyingSword', level: 3 }, 'weapon', new Set())

    expect(presentation).toMatchObject({
      id: 'flyingSword',
      visualKind: 'weapon',
      kindLabel: '법보',
      name: '비검',
      levelText: 'Lv.3/5',
      description: '가장 가까운 적을 추적하는 검을 날린다.',
    })
    expect(presentation.alt).toContain('비검 법보 아이콘 · Lv.3/5 · 효과:')
    expect(itemPresentation({ id: 'myriadSwords', level: 1 }, 'weapon', new Set()).visualKind)
      .toBe('evolution')
    expect(itemPresentation({ id: 'futureWeapon', level: 1 }, 'weapon', new Set()).name)
      .toBe('futureWeapon')
  })

  it('preserves HUD nullish fallback and level-clamp semantics separately', () => {
    expect(hudItemPresentation({ id: 'flyingSword', name: '', desc: '', level: -2 }, 'weapon'))
      .toMatchObject({ name: '', effect: '', level: 0, levelText: 'Lv.0/5' })
    expect(itemPresentation({ id: 'flyingSword', name: '', level: -2 }, 'weapon', new Set()))
      .toMatchObject({ name: '비검', level: -2, levelText: 'Lv.-2/5' })
  })
})
