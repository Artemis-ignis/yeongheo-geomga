import { describe, expect, it } from 'vitest'
import { validateManifestData } from '../tools/asset-audit.mjs'

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
})
