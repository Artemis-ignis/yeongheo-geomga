import * as THREE from 'three'

/**
 * Blades across the whole plateau.
 *
 * 26k over a 48-unit disc is 3.6 blades per square metre, which is not a field
 * — it is confetti with gaps you can see the floor through. The count has to
 * carry the whole arena because the player walks all of it, and it is one
 * instanced draw either way.
 */
const BASE_BLADE_COUNT = 92000

/** Blades per tuft. Grass grows in clumps; uniform scatter never reads as grass. */
const TUFT_SIZE = 7
const TUFT_SPREAD = 0.42
const CLEARING = 4

/**
 * Instanced grass and 영초 across the plateau.
 *
 * A textured plane still reads as a plane; scattered vertical geometry is what
 * gives the ground a sense of scale and makes the character feel like she is
 * standing *in* somewhere. Every blade bends in the vertex shader from a
 * per-instance seed, so the CPU does nothing per frame.
 */
export class Grass {
  constructor(scene, innerRadius, outerRadius, opts = {}) {
    const pal = opts.palette ?? {}
    const density = opts.density ?? 1
    this.scene = scene

    // A tapered blade: wide at the base, pinched to a point.
    const blade = new THREE.BufferGeometry()
    // Knee height on a 1.9-unit cultivator. Taller than this and the field hides
    // the horde, which matters more than how lush it looks.
    const h = 0.42
    const w = 0.055
    const positions = new Float32Array([
      -w, 0, 0, w, 0, 0, -w * 0.62, h * 0.45, 0,
      w, 0, 0, w * 0.62, h * 0.45, 0, -w * 0.62, h * 0.45, 0,
      -w * 0.62, h * 0.45, 0, w * 0.62, h * 0.45, 0, 0, h, 0,
    ])
    const heights = new Float32Array([0, 0, 0.45, 0, 0.45, 0.45, 0.45, 0.45, 1])
    blade.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    blade.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1))

    const geo = new THREE.InstancedBufferGeometry()
    geo.index = blade.index
    geo.attributes = blade.attributes

    const bladeCount = Math.max(500, Math.round(BASE_BLADE_COUNT * density))
    const offset = new Float32Array(bladeCount * 3)
    const seed = new Float32Array(bladeCount * 3)
    let placed = 0
    let guard = 0
    while (placed < bladeCount && guard < bladeCount * 6) {
      guard++
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * outerRadius
      if (r < CLEARING) continue
      const cx = Math.cos(a) * r
      const cz = Math.sin(a) * r
      // One tuft per placement, so the field has clumps and bare patches
      // between them rather than an even sprinkle.
      const tuft = Math.min(TUFT_SIZE, bladeCount - placed)
      const vigour = 0.55 + Math.random() * 0.75
      for (let k = 0; k < tuft; k++) {
        // Gaussian-ish falloff from the tuft centre: dense middle, loose edge.
        const ta = Math.random() * Math.PI * 2
        const tr = (Math.random() + Math.random()) * 0.5 * TUFT_SPREAD
        offset[placed * 3 + 0] = cx + Math.cos(ta) * tr
        offset[placed * 3 + 1] = 0
        offset[placed * 3 + 2] = cz + Math.sin(ta) * tr
        seed[placed * 3 + 0] = Math.random()
        seed[placed * 3 + 1] = Math.random()
        // Taller out on the rim where nothing has trampled it, and blades in one
        // tuft share a vigour so a clump reads as one plant rather than as
        // strangers standing close together.
        seed[placed * 3 + 2] = vigour * (0.72 + Math.random() * 0.5)
          * (0.6 + (r / outerRadius) * 0.8)
        placed++
      }
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3))
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 3))
    geo.instanceCount = placed

    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uPlayer: { value: new THREE.Vector3() },
        uBase: { value: new THREE.Color(pal.grassBase ?? 0x2f6b4f) },
        uTip: { value: new THREE.Color(pal.grassTip ?? 0x9fd88a) },
        uFogColor: { value: new THREE.Color(pal.fog ?? 0x9db9c9) },
        uFogDensity: { value: 0.0085 },
      },
      vertexShader: `
        attribute vec3 aOffset;
        attribute vec3 aSeed;
        attribute float aHeight;
        uniform float uTime;
        uniform vec3 uPlayer;
        varying float vH;
        varying float vShade;
        varying float vTint;
        varying float vFogDepth;

        void main() {
          vH = aHeight;
          float scale = aSeed.z;

          // Rotate each blade to its own facing so the field is not all aligned.
          float rot = aSeed.x * 6.2831;
          float cr = cos( rot ), sr = sin( rot );
          vec3 p = vec3( position.x * cr, position.y, position.x * sr );
          p.y *= scale;

          vec3 world = aOffset + p;

          // Wind: two waves at different scales, only affecting the upper blade.
          float bend = aHeight * aHeight;
          float wind = sin( uTime * 1.6 + aOffset.x * 0.25 + aSeed.y * 6.28 ) * 0.16
                     + sin( uTime * 3.1 + aOffset.z * 0.4 ) * 0.06;
          world.x += wind * bend * scale;
          world.z += wind * 0.6 * bend * scale;

          // Push away from the player so she parts the grass as she runs.
          vec2 away = world.xz - uPlayer.xz;
          float d = length( away );
          float press = smoothstep( 1.9, 0.0, d );
          world.xz += normalize( away + vec2( 0.0001 ) ) * press * 0.42 * bend;
          world.y -= press * 0.25 * bend * scale;

          // Arc the blade over as it rises instead of standing it up straight.
          // A field of straight spikes reads as a pincushion; the curve is what
          // says "grass" before any of the colour does.
          float arc = bend * scale * ( 0.10 + aSeed.x * 0.16 );
          world.x += cos( rot ) * arc;
          world.z += sin( rot ) * arc;

          vShade = 0.55 + aSeed.y * 0.45;
          // Per-blade hue drift between a cool and a warm green, so a clump has
          // internal variation rather than being one flat colour repeated.
          vTint = aSeed.x;
          vec4 mv = viewMatrix * vec4( world, 1.0 );
          vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uBase;
        uniform vec3 uTip;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying float vH;
        varying float vShade;
        varying float vTint;
        varying float vFogDepth;

        void main() {
          vec3 col = mix( uBase, uTip, vH * vH ) * vShade;

          // Per-blade hue drift, warm one way and cool the other. A field where
          // every blade is the same two colours reads as one painted surface
          // however many blades are in it.
          col.r *= 0.90 + vTint * 0.24;
          col.b *= 1.10 - vTint * 0.24;

          // Darken sharply at the very base so blades sink into the ground
          // instead of sitting on top of it like cut-outs. This contact shading
          // is doing the job an ambient occlusion pass would, for free.
          col *= 0.42 + 0.58 * smoothstep( 0.0, 0.30, vH );

          // Matches the scene's FogExp2 so the field recedes with everything else.
          float f = 1.0 - exp( - uFogDensity * uFogDensity * vFogDepth * vFogDepth );
          gl_FragColor = vec4( mix( col, uFogColor, clamp( f, 0.0, 1.0 ) ), 1.0 );
        }`,
    })

    this.mesh = new THREE.Mesh(geo, this.material)
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
    void innerRadius
  }

  update(dt, playerX, playerZ) {
    this.material.uniforms.uTime.value += dt
    this.material.uniforms.uPlayer.value.set(playerX, 0, playerZ)
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.mesh.removeFromParent()
  }
}
