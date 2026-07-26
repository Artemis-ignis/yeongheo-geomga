import * as THREE from 'three'

/** Named colours shared across the whole game. Never inline a hex elsewhere. */
export const PALETTE = {
  jade: 0x7fd6b5,
  jadeDark: 0x2f5d4e,
  gold: 0xe8c56a,
  mist: 0xc8e6f5,
  blood: 0xd9534f,
  void: 0x2a1f3d,
  skyTop: 0x1b2450,
  skyBottom: 0xe9c9a0,
  fog: 0x5c6f8a,
  stone: 0x7d7466,
  pine: 0x2d5442,
}

let rampCache = null

/**
 * A stepped greyscale gradient map. Nearest filtering is what turns smooth
 * lambert shading into flat cel bands.
 */
export function toonRamp(steps = 4) {
  if (rampCache) return rampCache
  const data = new Uint8Array(steps * 4)
  for (let i = 0; i < steps; i++) {
    // Start at 0.32 rather than 0 so shadowed faces stay readable.
    const v = Math.round((0.32 + (i / (steps - 1)) * 0.68) * 255)
    data[i * 4 + 0] = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  rampCache = tex
  return tex
}

/**
 * Cel-shaded material with a Fresnel rim light injected via onBeforeCompile.
 *
 * The rim uses its own varyings rather than relying on three's internal ones,
 * so it does not break when the built-in chunks are reorganised between releases.
 */
export function makeToonMaterial({ color, rim = 0.35, rimColor = 0xffffff, ...opts } = {}) {
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonRamp(),
    ...opts,
  })

  material.userData.rim = { value: rim }
  material.userData.rimColor = { value: new THREE.Color(rimColor) }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimStrength = material.userData.rim
    shader.uniforms.uRimColor = material.userData.rimColor

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRimN;\nvarying vec3 vRimV;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vRimN = normalize( normalMatrix * objectNormal );
         vRimV = normalize( -mvPosition.xyz );`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vRimN;
         varying vec3 vRimV;
         uniform float uRimStrength;
         uniform vec3 uRimColor;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float rimDot = 1.0 - clamp( dot( normalize( vRimN ), normalize( vRimV ) ), 0.0, 1.0 );
         gl_FragColor.rgb += uRimColor * pow( rimDot, 2.5 ) * uRimStrength;`,
      )
  }

  // Every toon material compiles to the same program, so they share one cache entry.
  material.customProgramCacheKey = () => 'toonRim'
  return material
}

/** Additive, depth-write-off material for glows, formations, and VFX. */
export function makeAdditiveMaterial({ color = 0xffffff, opacity = 1, map = null } = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    map,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

/** Flat unlit material for things that should ignore scene lighting (faces, decals). */
export function makeFlatMaterial({ color = 0xffffff, map = null, opacity = 1 } = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    map,
    transparent: opacity < 1 || map !== null,
    opacity,
    depthWrite: opacity >= 1,
  })
}
