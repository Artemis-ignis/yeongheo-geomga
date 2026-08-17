import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateAuthoringPipelines, validateManifestData } from '../tools/asset-audit.mjs'

const validAsset = {
  id: 'hero.reference',
  path: 'public/assets/characters/hero.png',
  role: 'runtime-character-reference',
  tier: 'hero',
  source: 'imagegen',
  consumers: ['src/ui/TitleScreen.js'],
  maxBytes: 100,
}

function validate(overrides = {}, options = {}) {
  return validateManifestData({
    schemaVersion: 1,
    runtimeRoot: 'public/assets',
    authoringRoot: 'assets-source',
    runtimeRasterFormat: 'png',
    assets: [{ ...validAsset, ...overrides }],
  }, {
    actualFiles: ['public/assets/characters/hero.png'],
    fileExists: () => true,
    sourceFiles: [{ file: 'src/ui/TitleScreen.js', text: 'hero.png' }],
    ...options,
  })
}

describe('asset manifest audit', () => {
  it('accepts a declared, referenced asset', () => {
    expect(validate().ok).toBe(true)
  })

  it('rejects duplicate ids and paths', () => {
    const result = validateManifestData({
      schemaVersion: 1,
      runtimeRoot: 'public/assets',
      authoringRoot: 'assets-source',
      runtimeRasterFormat: 'png',
      assets: [validAsset, { ...validAsset }],
    }, {
      actualFiles: ['public/assets/characters/hero.png'],
      fileExists: () => true,
      sourceFiles: [{ file: 'src/ui/TitleScreen.js', text: 'hero.png' }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'duplicate asset id: hero.reference',
      'duplicate asset path: public/assets/characters/hero.png',
    ]))
  })

  it('rejects unmanifested runtime files', () => {
    const result = validate({}, { actualFiles: ['public/assets/characters/hero.png', 'public/assets/extra.png'] })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('unmanifested runtime file: public/assets/extra.png')
  })

  it('rejects a declared asset that the runtime does not reference', () => {
    const result = validate({}, { sourceFiles: [{ file: 'src/ui/TitleScreen.js', text: 'no asset here' }] })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('hero.reference: no runtime source reference found for public/assets/characters/hero.png')
  })

  it('requires authoring assets to live outside the public runtime tree', () => {
    const result = validate({ tier: 'authoring', path: 'public/assets/source/hero.png' })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('hero.reference: path must stay under assets-source')
  })

  it('accepts an audited authoring source under the dedicated authoring root', () => {
    const result = validate({
      tier: 'authoring',
      path: 'assets-source/sprites2d/hero.png',
      consumers: ['tools/yeongheo/sprite-authoring-manifest.json'],
    }, {
      actualFiles: ['assets-source/sprites2d/hero.png'],
      sourceFiles: [{ file: 'tools/yeongheo/sprite-authoring-manifest.json', text: 'hero.png' }],
    })
    expect(result.ok).toBe(true)
  })

  it('enforces the configured lossless runtime raster format without constraining authoring sources', () => {
    const runtime = validate({ path: 'public/assets/characters/hero.png' }, {
      actualFiles: ['public/assets/characters/hero.png'],
    })
    expect(runtime.ok).toBe(true)

    const wrongFormat = validateManifestData({
      schemaVersion: 1,
      runtimeRoot: 'public/assets',
      authoringRoot: 'assets-source',
      runtimeRasterFormat: 'webp',
      assets: [validAsset],
    }, {
      actualFiles: ['public/assets/characters/hero.png'],
      fileExists: () => true,
      sourceFiles: [{ file: 'src/ui/TitleScreen.js', text: 'hero.png' }],
    })
    expect(wrongFormat.errors).toContain('hero.reference: runtime raster must use .webp')
  })
})

describe('authoring pipeline manifest', () => {
  const runtimeAsset = { ...validAsset, path: 'public/assets/sprites2d/hero.webp', tier: 'hero' }
  const authoringAsset = {
    ...validAsset,
    id: 'hero.source',
    path: 'assets-source/sprites2d/hero-sheet.png',
    tier: 'authoring',
    consumers: ['tools/yeongheo/sprite-authoring-manifest.json'],
  }
  const manifest = {
    runtimeRoot: 'public/assets',
    authoringRoot: 'assets-source',
    assets: [runtimeAsset, authoringAsset],
  }
  const authoring = {
    sourceRoot: 'assets-source/sprites2d',
    runtimeRoot: 'public/assets/sprites2d',
    pipelines: [{ actor: 'hero', source: 'hero-sheet.png', outputs: ['hero.webp'] }],
  }

  it('requires every authoring source to map exactly once to a declared runtime output', () => {
    expect(validateAuthoringPipelines(manifest, authoring)).toMatchObject({ ok: true, pipelineCount: 1 })
  })

  it('rejects missing source declarations and undeclared runtime outputs', () => {
    const result = validateAuthoringPipelines(manifest, {
      ...authoring,
      pipelines: [{ actor: 'hero', source: 'missing.png', outputs: ['missing.webp'] }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('undeclared authoring source'),
      expect.stringContaining('undeclared runtime output'),
      expect.stringContaining('authoring source must map exactly once'),
    ]))
  })

  it('keeps the Jade Void Warden reaction source and runtime as one declared pipeline', () => {
    const manifest = JSON.parse(readFileSync(new URL('../tools/asset-manifest.json', import.meta.url), 'utf8'))
    const authoring = JSON.parse(readFileSync(new URL('../tools/yeongheo/sprite-authoring-manifest.json', import.meta.url), 'utf8'))
    const runtime = manifest.assets.find((asset) => asset.path === 'public/assets/sprites2d/jade-void-warden-reaction-v1.webp')
    const source = manifest.assets.find((asset) => asset.path === 'assets-source/sprites2d/jade-void-warden-reaction-sheet-v1.png')
    const pipeline = authoring.pipelines.find((entry) => entry.actor === 'jade-void-warden-reaction')

    expect(runtime).toMatchObject({
      id: 'sprite2d.jade-void-warden.reaction.v1',
      role: 'runtime-2d-boss-reaction-atlas',
      tier: 'boss',
      consumers: ['src/runtime2d/spriteManifest.js'],
    })
    expect(source).toMatchObject({
      id: 'sprite2d.source.jade-void-warden.reaction.v1',
      role: 'authoring-2d-boss-reaction-sheet',
      tier: 'authoring',
      consumers: ['tools/yeongheo/sprite-authoring-manifest.json'],
    })
    expect(pipeline).toEqual({
      actor: 'jade-void-warden-reaction',
      source: 'jade-void-warden-reaction-sheet-v1.png',
      outputs: ['jade-void-warden-reaction-v1.webp'],
    })
    expect(validateAuthoringPipelines({
      ...manifest,
      assets: [runtime, source],
    }, {
      ...authoring,
      pipelines: [pipeline],
    })).toMatchObject({ ok: true, pipelineCount: 1 })
  })
})
