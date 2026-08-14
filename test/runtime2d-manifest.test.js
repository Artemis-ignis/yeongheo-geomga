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

  it('ships the common wisp as a real hover and attack atlas', () => {
    const wisp = SPRITE_MANIFEST.actors.wisp
    expect(wisp.url).toContain('magi-remnant-motion-v2.webp')
    expect(wisp.cell).toEqual([256, 256])
    expect(wisp.sheet).toEqual([4, 2])
    expect(wisp.animations.hover).toEqual([0, 1, 2, 3])
    expect(wisp.animations.attack).toEqual([4, 5, 6, 7])
    expect(new Set([...wisp.animations.hover, ...wisp.animations.attack]).size).toBe(8)
  })

  it('ships one coherent five-direction heroine with full run and attack cycles', () => {
    const hero = SPRITE_MANIFEST.actors.seolryeong
    expect(hero.cell).toEqual([384, 256])
    expect(hero.sheet).toEqual([4, 4])
    expect(hero.animations.run).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(hero.animations.attack).toEqual([8, 9, 10, 11, 12, 13, 14, 15])
    expect(hero.url).toContain('seolryeong-heroine-southeast-motion-v2.webp')
    for (const direction of ['east', 'northeast']) {
      expect(hero.directionalRuntime[direction].url).toContain('-motion-v2.webp')
    }
    for (const direction of ['north', 'south']) {
      expect(hero.directionalRuntime[direction].url).toContain('-motion-v3.webp')
    }
    expect(Object.keys(hero.reactionRuntime).sort()).toEqual([
      'east', 'north', 'northeast', 'south', 'southeast',
    ])
    expect(hero.reactionCell).toEqual([384, 256])
    expect(hero.reactionSheet).toEqual([4, 2])
    expect(hero.reactionAnimations).toEqual({
      idle: [0, 1], hurt: [2, 3], death: [4, 5, 6, 7],
    })
  })

  it('ships low quadruped north and south view candidates for yorang', () => {
    const yorang = SPRITE_MANIFEST.actors.yorang
    expect(yorang.directionalRuntime.north.url).toContain('yorang-north-motion-v5.webp')
    expect(yorang.directionalRuntime.south.url).toContain('yorang-south-motion-v4.webp')
    expect(yorang.animations.walk).toEqual([0, 1, 2, 3])
    expect(yorang.animations.attack).toEqual([4, 5, 6, 7])
    expect(Object.keys(yorang.reactionRuntime).sort()).toEqual(['default', 'north', 'south'])
    expect(yorang.reactionCell).toEqual([256, 256])
    expect(yorang.reactionSheet).toEqual([4, 2])
    expect(yorang.reactionAnimations).toEqual({ hurt: [0, 1], death: [2, 3, 4, 5, 6, 7] })
  })

  it('ships north and south candidates for common jade enemies', () => {
    for (const [key, slug] of [
      ['jadeRidgeHound', 'jade-ridge-hound'],
      ['jadeSerpent', 'jade-serpent'],
    ]) {
      const actor = SPRITE_MANIFEST.actors[key]
      expect(actor.directionalRuntime.north.url).toContain(`${slug}-north-motion-v2.webp`)
      expect(actor.directionalRuntime.south.url).toContain(`${slug}-south-motion-v2.webp`)
    }
  })

  it('does not admit unreleased chapter-two candidates to the global runtime manifest', () => {
    expect(SPRITE_MANIFEST.actors.magmaBrute).toBeUndefined()
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
    for (const id of [
      'yorang', 'jadeRidgeHound', 'jadeSerpent', 'bloodScorpion',
      'talismanRevenant', 'maskedSealRevenant',
    ]) {
      expect(SPRITE_MANIFEST.actors[id].runtimeHeight).toBeGreaterThanOrEqual(55)
      expect(SPRITE_MANIFEST.actors[id].runtimeHeight).toBeLessThanOrEqual(95)
    }
    for (const id of ['jadeStoneGhoul', 'jadeShardGuardian']) {
      expect(SPRITE_MANIFEST.actors[id].runtimeHeight).toBeLessThanOrEqual(110)
    }
    for (const id of ['voidSentinel', 'shadowSealDuelist']) {
      expect(SPRITE_MANIFEST.actors[id].runtimeHeight).toBeLessThanOrEqual(120)
    }
  })

  it('never drops render resolution below 0.85', () => {
    const quality = new Quality2D()
    for (let i = 0; i < 60; i++) quality.sample(40)
    expect(quality.scale).toBe(0.85)
    expect(quality.effectsDensity).toBeLessThan(1)
  })
})
