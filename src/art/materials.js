import * as THREE from 'three'

/** Named colours shared across the whole game. Never inline a hex elsewhere. */
export const PALETTE = {
  jade: 0x7fd6b5,
  jadeDark: 0x2f5d4e,
  gold: 0xe8c56a,
  mist: 0xc8e6f5,
  blood: 0xd9534f,
  void: 0x2a1f3d,
  skyTop: 0x161c3f,
  skyMid: 0x5f86ad,
  skyHaze: 0xbfd8e2,
  skyBottom: 0xf2dcb8,
  abyss: 0x2c3f57,
  fog: 0x9db9c9,
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
/**
 * Idle and stride motion for an instanced crowd, done entirely in the vertex
 * shader.
 *
 * A horde of rigid meshes sliding across the ground is the loudest tell that a
 * game is a prototype, and skinning several hundred creatures is not affordable
 * here. Each instance carries a phase and a 0..1 movement amount instead, and
 * the shader bobs, leans and rolls the whole body around its own feet. The
 * models are all built with y=0 at the ground, so rotating about the origin
 * pivots at the feet for free.
 */
const CREATURE_ANIM = `
  float aPhase = aAnim.x;
  float aMove = aAnim.y;
  float bt = uTime * ( 3.4 + aMove * 5.2 ) + aPhase;
  // Bob, scaled by height so the feet stay planted.
  transformed.y += sin( bt ) * ( 0.022 + aMove * 0.038 ) * transformed.y;
  // Lean forward and back, and roll side to side as it runs.
  float lean = sin( bt * 0.5 ) * ( 0.032 + aMove * 0.078 );
  float roll = sin( bt * 0.5 + 1.57 ) * aMove * 0.075;
  float cl = cos( lean ), sl = sin( lean );
  transformed.yz = vec2( transformed.y * cl - transformed.z * sl,
                         transformed.y * sl + transformed.z * cl );
  float cr = cos( roll ), sr = sin( roll );
  transformed.xy = vec2( transformed.x * cr - transformed.y * sr,
                         transformed.x * sr + transformed.y * cr );
`

export function makeToonMaterial({
  color, rim = 0.35, rimColor = 0xffffff, creatureAnim = false, pbr = false, ...opts
} = {}) {
  const material = pbr
    ? new THREE.MeshStandardMaterial({
      color,
      roughness: 0.56,
      metalness: 0.12,
      ...opts,
    })
    : new THREE.MeshToonMaterial({
      color,
      gradientMap: toonRamp(),
      ...opts,
    })

  material.userData.rim = { value: rim }
  material.userData.rimColor = { value: new THREE.Color(rimColor) }
  material.userData.time = { value: 0 }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimStrength = material.userData.rim
    shader.uniforms.uRimColor = material.userData.rimColor

    if (creatureAnim) {
      shader.uniforms.uTime = material.userData.time
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute vec2 aAnim;\nuniform float uTime;',
        )
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${CREATURE_ANIM}`)
    }

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

  // Toon materials compile to one of two programs, so they share cache entries.
  material.customProgramCacheKey = () => `${pbr ? 'pbr' : 'toon'}Rim${creatureAnim ? 'Anim' : ''}`
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

/**
 * Inverted-hull outline material.
 *
 * Renders back faces only, pushed outward along the normal, in near-black. It is
 * the cheapest way to get a real cel outline, and outlines are most of what
 * separates "anime character" from "assortment of shaded primitives".
 */
export function makeOutlineMaterial(thickness = 0.02, color = 0x121820) {
  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    fog: true,
    // Our creatures are merged from many overlapping parts, so they are not
    // watertight: an inner part's inflated back-faces can land in front of an
    // outer part and swallow the whole model. Biasing the outline away from the
    // camera guarantees the shaded surface always wins the depth test.
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 4,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uThickness = { value: thickness }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uThickness;')
      .replace(
        '#include <begin_vertex>',
        // `normal` rather than `objectNormal`: MeshBasicMaterial only declares
        // objectNormal under USE_ENVMAP/USE_SKINNING, so referencing it here
        // fails to compile and the outline silently never draws.
        `#include <begin_vertex>
         transformed += normalize( normal ) * uThickness;`,
      )
  }
  material.customProgramCacheKey = () => `outline${thickness}`
  return material
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
