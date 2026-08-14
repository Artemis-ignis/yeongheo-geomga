import { describe, expect, it } from 'vitest'
import {
  formatHpReadout, RADAR_POI_STYLE, radarHeadingRotation, radarPointPosition,
} from '../src/ui/Hud.js'

describe('2D HUD radar', () => {
  it('keeps world points and heading aligned with the combat screen', () => {
    expect(radarPointPosition({ x: 0, z: 1 }, 40)).toEqual({ x: 0, y: 40 })
    expect(radarPointPosition({ x: 1.8, z: -2 }, 40)).toEqual({ x: 40, y: -40 })
    expect(radarHeadingRotation(0)).toBeCloseTo(Math.PI)
    expect(radarHeadingRotation(Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    expect(radarHeadingRotation(Math.PI)).toBeCloseTo(0)
  })

  it('keeps authored POI symbols distinct from hostile radar dots', () => {
    expect(RADAR_POI_STYLE).toMatchObject({
      altar: { color: '#d0ad62', glyph: '수' },
      treasure: { color: '#d8c89e', glyph: '보' },
      elite_seal: { color: '#b94a3d', glyph: '봉' },
      healing_spring: { color: '#7aa28d', glyph: '회' },
    })
    expect(Object.values(RADAR_POI_STYLE).map(({ glyph }) => glyph).join('')).not.toMatch(/[\u3400-\u9fff]/u)
  })
})

describe('2D HUD health readout', () => {
  it('never displays current health above a fractional maximum', () => {
    expect(formatHpReadout(152.25, 152.25)).toBe('153 / 153')
    expect(formatHpReadout(152.4, 152.25)).toBe('153 / 153')
    expect(formatHpReadout(151.01, 152.25)).toBe('152 / 153')
  })

  it('clamps invalid and negative input to a truthful non-negative readout', () => {
    expect(formatHpReadout(Number.NaN, 115)).toBe('0 / 115')
    expect(formatHpReadout(-3, 115)).toBe('0 / 115')
    expect(formatHpReadout(10, -1)).toBe('0 / 0')
  })
})
