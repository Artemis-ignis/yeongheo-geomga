import { describe, expect, it } from 'vitest'
import { formatHpReadout, RADAR_POI_STYLE, radarPointPosition } from '../src/ui/Hud.js'

describe('2D HUD radar', () => {
  it('maps player-forward world +Z to the top of the radar and clamps the edge', () => {
    expect(radarPointPosition({ x: 0, z: 1 }, 40)).toEqual({ x: 0, y: -40 })
    expect(radarPointPosition({ x: 1.8, z: -2 }, 40)).toEqual({ x: 40, y: 40 })
  })

  it('keeps authored POI symbols distinct from hostile radar dots', () => {
    expect(RADAR_POI_STYLE).toMatchObject({
      altar: { color: '#f2c76f', glyph: '수' },
      treasure: { color: '#8edcff', glyph: '보' },
      elite_seal: { color: '#ef79aa', glyph: '봉' },
      healing_spring: { color: '#73e3bd', glyph: '회' },
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
