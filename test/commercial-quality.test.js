import { describe, expect, it } from 'vitest'
import { SPRITE_MANIFEST } from '../src/runtime2d/spriteManifest.js'
import { auditCommercialQuality } from '../tools/commercial-quality-audit.mjs'

describe('commercial quality gate', () => {
  it('reports the current build as blocked instead of confusing functional PASS with sale readiness', () => {
    const report = auditCommercialQuality()
    expect(report.ok).toBe(false)
    expect(report.commercialStatus).toBe('BLOCKED')
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('CQ-P0-MOTION-002'),
      expect.stringContaining('CQ-P0-PRODUCT-001'),
      expect.stringContaining('evidence:completeGameStructure'),
      expect.stringContaining('release:rightsGate'),
    ]))
  })

  it('requires visual approval and production readiness for every actor', () => {
    const report = auditCommercialQuality()
    for (const id of Object.keys(SPRITE_MANIFEST.actors)) {
      expect(report.blockers).toContain(`actor:${id}: visual approval pending`)
      expect(report.blockers).toContain(`actor:${id}: productionReady is not true`)
    }
  })

  it('accepts the authored heroine reaction contract while keeping human visual approval open', () => {
    const report = auditCommercialQuality()
    expect(report.blockers.some((item) => item.startsWith('motion:seolryeong.'))).toBe(false)
    expect(report.blockers).toContain('actor:seolryeong: visual approval pending')
  })

  it('accepts completed yorang reactions while retaining unresolved enemy motion blockers', () => {
    const report = auditCommercialQuality()
    expect(report.blockers).toEqual(expect.arrayContaining([
      'motion:wisp.directions: 1/3 authored views',
      'motion:jadeRidgeHound.hurt: 0/2 frames',
      'motion:jadeRidgeHound.death: 0/3 frames',
    ]))
    expect(report.blockers.some((item) => item.startsWith('motion:yorang.'))).toBe(false)
  })

  it('can pass only with closed blockers, complete evidence, approved assets and rights', () => {
    const approvedManifest = {
      actors: {
        hero: {
          role: 'hero', directions: ['s', 'se', 'e', 'ne', 'n'],
          animations: {
            run: [0, 1, 2, 3], dash: [0, 1, 2], attack: [0, 1, 2, 3],
          },
          reactionAnimations: { idle: [0, 1], hurt: [0, 1], death: [0, 1, 2] },
          visualApproval: 'approved', productionReady: true,
        },
      },
      environment: {
        stage: { visualApproval: 'approved', productionReady: true },
      },
    }
    const readiness = {
      target: 'paid-commercial-candidate',
      commercialStatus: 'CANDIDATE',
      blockers: [],
      evidence: {
        immutableRunId: 'CQ-TEST-1', buildHash: 'abc123',
        chrome1920x1080: 'pass', chrome2560x1600: 'pass',
        currentExpeditionFullRun: 'pass', completeGameStructure: 'pass',
        contentCompleteness: 'pass', performance: 'pass',
        rightsLedger: 'pass', humanVisualApproval: 'pass',
      },
    }
    const release = { rightsGate: 'PASS', rightsEvidenceConfirmed: 1, runtimeImageAssets: 1 }
    expect(auditCommercialQuality({ readiness, release, manifest: approvedManifest })).toMatchObject({
      ok: true, commercialStatus: 'CANDIDATE', blockerCount: 0,
    })
  })
})
