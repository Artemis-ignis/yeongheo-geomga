const SOFTWARE_RENDERER_PATTERN = /microsoft basic render driver|swiftshader|llvmpipe|softpipe|software rasterizer|\bwarp\b/i

export function isSoftwareRenderer(label = '') {
  return SOFTWARE_RENDERER_PATTERN.test(String(label))
}

export function choosePixiBackend(rendererLabel = '', requested = '') {
  if (requested === 'canvas') return 'canvas'
  if (requested === 'webgl') return 'webgl'
  return isSoftwareRenderer(rendererLabel) ? 'canvas' : 'webgl'
}

export function probeWebGLRenderer() {
  if (typeof document === 'undefined') return { label: 'unavailable', version: 0 }
  try {
    const canvas = document.createElement('canvas')
    const options = { antialias: false, powerPreference: 'high-performance' }
    const gl = canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)
    if (!gl) return { label: 'unavailable', version: 0 }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const label = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER)
    const version = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? 2 : 1
    return { label: label || 'unknown', version }
  } catch {
    return { label: 'unavailable', version: 0 }
  }
}
