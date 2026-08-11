import { describe, expect, it } from 'vitest'
import { SPRITE_MANIFEST, validateSpriteManifest } from '../src/runtime2d/spriteManifest.js'
import { Quality2D } from '../src/runtime2d/Quality2D.js'

describe('runtime2d sprite contract', () => {
  it('accepts the shipped manifest and keeps visual approval pending', () => {
    expect(validateSpriteManifest()).toEqual([])
    for (const actor of Object.values(SPRITE_MANIFEST.actors)) {
      expect(actor.productionReady).toBe(false)
      expect(actor.visualApproval).toBe('pending')
      expect(actor.pivot[1]).toBeGreaterThanOrEqual(0.85)
    }
  })

  it('rejects production readiness without human visual approval', () => {
    const invalid = {
      ...SPRITE_MANIFEST,
      actors: {
        test: {
          url: '/test.png', pivot: [0.5, 0.95], runtimeHeight: 100,
          directions: ['s'], visualApproval: 'pending', productionReady: true,
        },
      },
    }
    expect(validateSpriteManifest(invalid)).toContain('test: productionReady requires visual approval')
  })

  it('rejects duplicated and out-of-range animation frames', () => {
    const invalid = {
      ...SPRITE_MANIFEST,
      actors: {
        test: {
          url: '/test.png', pivot: [0.5, 0.9], runtimeHeight: 100,
          directions: ['se'], sheet: [2, 1],
          animations: { walk: [0, 0], attack: [2] },
          visualApproval: 'pending', productionReady: false,
        },
      },
    }
    expect(validateSpriteManifest(invalid)).toEqual(expect.arrayContaining([
      'test.walk: duplicate frames',
      'test.attack: frame out of range',
    ]))
  })

  it('keeps gameplay silhouettes inside the authored 2.5D screen-height budget', () => {
    expect(SPRITE_MANIFEST.actors.seolryeong.runtimeHeight).toBeGreaterThanOrEqual(110)
    expect(SPRITE_MANIFEST.actors.seolryeong.runtimeHeight).toBeLessThanOrEqual(140)
    expect(SPRITE_MANIFEST.actors.jadeVoidWarden.runtimeHeight).toBeLessThanOrEqual(220)
    for (const id of ['yorang', 'jadeSerpent', 'bloodScorpion', 'talismanRevenant']) {
      expect(SPRITE_MANIFEST.actors[id].runtimeHeight).toBeGreaterThanOrEqual(55)
      expect(SPRITE_MANIFEST.actors[id].runtimeHeight).toBeLessThanOrEqual(95)
    }
    expect(SPRITE_MANIFEST.actors.jadeStoneGhoul.runtimeHeight).toBeLessThanOrEqual(110)
    expect(SPRITE_MANIFEST.actors.voidSentinel.runtimeHeight).toBeLessThanOrEqual(120)
  })

  it('never drops render resolution below 0.85', () => {
    const quality = new Quality2D()
    for (let i = 0; i < 60; i++) quality.sample(40)
    expect(quality.scale).toBe(0.85)
    expect(quality.effectsDensity).toBeLessThan(1)
  })
})
