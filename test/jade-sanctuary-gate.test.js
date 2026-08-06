import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(path, 'utf8')
const adapter = read('src/art/JadeSanctuaryGate.js')
const factory = read('src/art/generated/JadeSanctuaryGateFactory.ts')
const upstream = read('tools/img2threejs/UPSTREAM.md')
const spec = JSON.parse(read('docs/assets/jade-sanctuary-gate-sculpt-spec.json'))

describe('Jade Sanctuary Gate official img2threejs integration', () => {
  it('keeps the downloaded upstream source and generated factory traceable', () => {
    const commit = 'd6673386f89673a58736f8d398dd16ece67874f5'
    expect(upstream).toContain('git clone --depth 1 https://github.com/img2threejs/img2threejs.git')
    expect(upstream).toContain(commit)
    expect(factory).toContain('// Generated from ObjectSculptSpec target: Jade Sanctuary Gate')
    expect(adapter).toContain("createJadeSanctuaryGateModel")
    expect(adapter).toContain(commit)
  })

  it('uses a generated factory LOD without replacing the hero presentation', () => {
    expect(spec.targetName).toBe('Jade Sanctuary Gate')
    expect(spec.componentTree).toHaveLength(20)
    expect(spec.materials).toHaveLength(6)
    expect(adapter).toContain("role: 'emergency-geometry-lod'")
    expect(adapter).toContain('root.userData.heroGroups')
    expect(adapter).toContain('generatedBlockout.visible = emergency')
  })
})
