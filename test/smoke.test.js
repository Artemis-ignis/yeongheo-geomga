import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
)

describe('project scaffold', () => {
  it('is an ES module project', () => {
    expect(pkg.type).toBe('module')
  })

  it('ships PixiJS and keeps the retired renderer development-only', () => {
    expect(pkg.dependencies['pixi.js']).toBeDefined()
    expect(pkg.dependencies.three).toBeUndefined()
    expect(pkg.devDependencies.three).toBeDefined()
  })
})
