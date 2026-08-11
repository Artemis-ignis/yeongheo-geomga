import { describe, expect, it } from 'vitest'
import { choosePixiBackend, isSoftwareRenderer } from '../src/runtime2d/backend.js'

describe('2D renderer backend selection', () => {
  it('keeps WebGL for hardware renderers', () => {
    expect(choosePixiBackend('ANGLE (NVIDIA, GeForce RTX 5070, D3D11)')).toBe('webgl')
  })

  it('uses Canvas2D for Microsoft software WebGL', () => {
    expect(isSoftwareRenderer('ANGLE (Microsoft, Microsoft Basic Render Driver, D3D11)')).toBe(true)
    expect(choosePixiBackend('ANGLE (Microsoft, Microsoft Basic Render Driver, D3D11)')).toBe('canvas')
  })

  it('recognizes common software rasterizers', () => {
    expect(choosePixiBackend('Google SwiftShader')).toBe('canvas')
    expect(choosePixiBackend('llvmpipe (LLVM 18.1.0, 256 bits)')).toBe('canvas')
  })

  it('honors an explicit diagnostics override', () => {
    expect(choosePixiBackend('Microsoft Basic Render Driver', 'webgl')).toBe('webgl')
    expect(choosePixiBackend('NVIDIA GeForce RTX', 'canvas')).toBe('canvas')
  })
})
