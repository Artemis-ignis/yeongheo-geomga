import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'

/**
 * Colour grade, vignette, and a subtle radial blur toward the edges.
 *
 * Flat toon shading with no grade reads as "untextured primitives" no matter how
 * good the geometry is. Lifting the shadows toward cool blue, pushing highlights
 * warm, and darkening the frame edges is most of what separates a raw viewport
 * from something that looks authored.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLift: { value: new THREE.Color(0x121a2a) },
    uGain: { value: new THREE.Color(0xfff2dd) },
    uSaturation: { value: 1.3 },
    uContrast: { value: 1.16 },
    uVignette: { value: 0.42 },
    uAberration: { value: 0.0016 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 0.3, 0.3) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 uLift;
    uniform vec3 uGain;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    uniform float uAberration;
    uniform float uFlash;
    uniform vec3 uFlashColor;
    varying vec2 vUv;

    void main() {
      vec2 toCentre = vUv - 0.5;
      float r2 = dot( toCentre, toCentre );

      // Chromatic aberration, strongest at the corners. Tiny, but it keeps the
      // edges from looking like clean flat vector art.
      float shift = uAberration * r2;
      vec3 col;
      col.r = texture2D( tDiffuse, vUv + toCentre * shift ).r;
      col.g = texture2D( tDiffuse, vUv ).g;
      col.b = texture2D( tDiffuse, vUv - toCentre * shift ).b;

      // Lift / gain: cool the shadows, warm the highlights.
      col = uLift + col * ( uGain - uLift );

      float luma = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      col = mix( vec3( luma ), col, uSaturation );
      col = ( col - 0.5 ) * uContrast + 0.5;

      float vig = smoothstep( 0.85, 0.15, r2 * uVignette * 4.0 );
      col *= mix( 0.55, 1.0, vig );

      // Damage flash, as a border only.
      //
      // r2 runs 0 at the centre to 0.5 at the corners, so the old ramp reached
      // full strength barely outside the middle and the previous floor of 0.35
      // tinted the centre as well. In a game where the player takes chip damage
      // continuously that is not a flash, it is a permanent red filter over
      // everything they are trying to read — which is exactly how it looked.
      // The middle of the frame is now untouched and the corners carry it.
      float edge = smoothstep( 0.055, 0.30, r2 );
      col = mix( col, uFlashColor, clamp( uFlash * edge, 0.0, 0.7 ) );

      gl_FragColor = vec4( clamp( col, 0.0, 1.0 ), 1.0 );
    }`,
}

/**
 * Post-processing stack.
 *
 * Bloom is what makes the 법보, 영기 orbs and the 결계 read as *energy* rather
 * than as coloured plastic — the toon materials deliberately push emissive
 * values above 1 so the bloom threshold catches them.
 */
export class Post {
  constructor(renderer, scene, camera, palette = {}) {
    this.renderer = renderer
    this.enabled = true

    const size = renderer.getSize(new THREE.Vector2())
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      // Tuned against captured frames. Anything stronger and the toon rim light
      // pushes the whole character over threshold, turning her into a white blob.
      0.30, // strength
      0.55, // radius
      0.95, // threshold — only genuinely bright things glow
    )
    this.composer.addPass(this.bloom)

    this.grade = new ShaderPass(GradeShader)
    // The grade belongs to the stage. Lifting every shadow toward the same navy
    // dragged a red wasteland and a snowfield back to looking like the same
    // blue-grey place however different their albedo was.
    if (palette.abyss !== undefined) this.grade.uniforms.uLift.value.setHex(palette.abyss).multiplyScalar(0.55)
    if (palette.skyBottom !== undefined) this.grade.uniforms.uGain.value.setHex(palette.skyBottom)
    this.composer.addPass(this.grade)

    this.fxaa = new ShaderPass(FXAAShader)
    this.composer.addPass(this.fxaa)

    this.composer.addPass(new OutputPass())
    this.setSize(size.x, size.y)
  }

  setCamera(camera) {
    this.composer.passes[0].camera = camera
  }

  /** Drive the damage / phase flash from Impact. */
  setFlash(strength, rgb) {
    this.grade.uniforms.uFlash.value = strength
    if (rgb) this.grade.uniforms.uFlashColor.value.setRGB(rgb[0], rgb[1], rgb[2])
  }

  setSize(width, height) {
    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))
    this.composer.setSize(w, h)
    this.bloom.setSize(w, h)
    const pr = this.renderer.getPixelRatio()
    this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr))
  }

  /** Dropped entirely at low quality — it is the most expensive thing we draw. */
  setEnabled(on) {
    this.enabled = on
  }

  render(scene, camera) {
    if (!this.enabled) {
      this.renderer.render(scene, camera)
      return
    }
    this.composer.render()
  }

  dispose() {
    this.composer.dispose?.()
  }
}
