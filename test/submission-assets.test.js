import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BOSSES } from '../src/data/bosses.js'
import { SPRITE_MANIFEST } from '../src/runtime2d/spriteManifest.js'
import {
  SUBMISSION_RUNTIME_ASSETS,
  auditSubmissionAssets,
  findProductionDebugMarkers,
  findUnallowlistedSubmissionAssetReferences,
  formatSubmissionAssetReport,
  pruneSubmissionAssets,
} from '../tools/submission-assets.mjs'

const temporaryRoots = []

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yeongheo-submission-assets-'))
  temporaryRoots.push(root)
  return root
}

function writeFixtureFile(root, relativePath, contents = relativePath) {
  const absolute = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  fs.writeFileSync(absolute, contents)
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop()
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('submission asset allowlist', () => {
  it('keeps dynamic production boss and Pixi asset references inside the exact allowlist', () => {
    const bossReferences = Object.values(BOSSES)
      .map((boss) => boss.referenceAsset)
      .filter(Boolean)
    const manifestReferences = [
      ...Object.values(SPRITE_MANIFEST.actors).flatMap((actor) => [
        actor.url,
        actor.portraitUrl,
        ...Object.values(actor.directionalRuntime ?? {}).map((direction) => direction.url),
        ...Object.values(actor.reactionRuntime ?? {}).map((direction) => direction.url),
      ]),
      ...Object.values(SPRITE_MANIFEST.environment ?? {}).map((asset) => asset.url),
    ].filter(Boolean)
    const productionReferences = [
      ...bossReferences,
      ...manifestReferences,
      './assets/environment/jade-sanctuary-environment-v2.webp',
      './assets/materials/environment/jade-highland-ground-v1.webp',
      './assets/materials/environment/jade-mountain-courtyard-ground-v4.webp',
      './assets/materials/environment/jade-pavilion-stone-v1.webp',
      './assets/characters/seolryeong-character-reference-v2.webp',
      './assets/characters/seolryeong-character-reference-v3.webp',
      './assets/brand/yeongheo-seal-v1.svg',
      './assets/marketing/yeongheo-ink-title-v1.webp',
      './assets/ui/ink-paper-texture-v1.svg',
    ]

    expect(bossReferences).not.toHaveLength(0)
    expect(findUnallowlistedSubmissionAssetReferences(bossReferences)).toEqual([])
    expect(findUnallowlistedSubmissionAssetReferences(productionReferences)).toEqual([])
  })

  it('keeps every source runtime asset available without admitting authoring files', () => {
    const root = fixtureRoot()
    const publicDir = path.join(root, 'public')
    const outDir = path.join(root, 'dist')
    for (const relativePath of SUBMISSION_RUNTIME_ASSETS) {
      writeFixtureFile(publicDir, relativePath)
      writeFixtureFile(outDir, relativePath)
    }
    // Simulate a stale public copy from an older checkout. The production
    // pruner must still remove it even though current authoring sources live
    // outside public/assets and are never copied by Vite.
    writeFixtureFile(publicDir, 'assets/sprites2d/source/authoring-sheet.png')
    writeFixtureFile(outDir, 'assets/sprites2d/source/authoring-sheet.png', 'authoring')
    writeFixtureFile(outDir, 'assets/Game2D.js', 'generated')

    const before = fs.readFileSync(path.join(publicDir, 'assets/sprites2d/source/authoring-sheet.png'), 'utf8')
    const result = pruneSubmissionAssets({ publicDir, outDir })
    const report = auditSubmissionAssets({ publicDir, outDir })

    expect(report.ok).toBe(true)
    expect(report.sourceMissing).toEqual([])
    expect(report.outputMissing).toEqual([])
    expect(report.unexpectedOutputAssets).toEqual([])
    expect(result.removed).toEqual(['assets/sprites2d/source/authoring-sheet.png'])
    expect(result.removedFileCount).toBe(1)
    expect(fs.existsSync(path.join(outDir, 'assets/sprites2d/source/authoring-sheet.png'))).toBe(false)
    expect(fs.readFileSync(path.join(publicDir, 'assets/sprites2d/source/authoring-sheet.png'), 'utf8')).toBe(before)
    expect(fs.existsSync(path.join(outDir, 'assets/Game2D.js'))).toBe(true)
    expect(formatSubmissionAssetReport({ ...report, before: result.before, after: result.after })).toContain('before=')
  })

  it('reports missing required output files and unexpected public asset types', () => {
    const root = fixtureRoot()
    const publicDir = path.join(root, 'public')
    const outDir = path.join(root, 'dist')
    writeFixtureFile(publicDir, SUBMISSION_RUNTIME_ASSETS[0])
    writeFixtureFile(outDir, SUBMISSION_RUNTIME_ASSETS[0])
    writeFixtureFile(outDir, 'assets/legacy/reference.webp')

    const report = auditSubmissionAssets({ publicDir, outDir })
    expect(report.ok).toBe(false)
    expect(report.sourceMissing).toHaveLength(SUBMISSION_RUNTIME_ASSETS.length - 1)
    expect(report.outputMissing).toHaveLength(SUBMISSION_RUNTIME_ASSETS.length - 1)
    expect(report.unexpectedOutputAssets).toEqual(['assets/legacy/reference.webp'])
  })

  it('rejects developer control surfaces from the production artifact', () => {
    const root = fixtureRoot()
    const publicDir = path.join(root, 'public')
    const outDir = path.join(root, 'dist')
    for (const relativePath of SUBMISSION_RUNTIME_ASSETS) {
      writeFixtureFile(publicDir, relativePath)
      writeFixtureFile(outDir, relativePath)
    }
    writeFixtureFile(outDir, 'assets/app.js', 'window.__game2dDiagnostics = () => 1')

    const report = auditSubmissionAssets({ publicDir, outDir })
    expect(report.ok).toBe(false)
    expect(findProductionDebugMarkers(outDir)).toEqual([
      { path: 'assets/app.js', marker: '__game2dDiagnostics' },
    ])
  })
})
