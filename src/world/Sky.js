import * as THREE from 'three'
import { makeToonMaterial, PALETTE } from '../art/materials.js'
import { buildMerged } from '../art/geometry.js'
import { moteTexture, petalTexture } from '../art/textures.js'
import { buildColored, gradient, roughen } from '../art/shapeKit.js'

const PETAL_COUNT = 300
const PETAL_BOX = 90
const ISLAND_COUNT = 5

const _dummy = new THREE.Object3D()

/**
 * Sky dome, distant floating islands, and drifting petals.
 *
 * Petal motion runs entirely in the vertex shader from a per-instance seed, so
 * 300 petals cost the CPU nothing per frame.
 */
export class Sky {
  constructor(scene, palette = {}) {
    this.scene = scene
    this.pal = {
      skyTop: PALETTE.skyTop, skyMid: PALETTE.skyMid, skyHaze: PALETTE.skyHaze,
      skyBottom: PALETTE.skyBottom, abyss: PALETTE.abyss, ...palette,
    }
    this.time = 0
    this.group = new THREE.Group()
    scene.add(this.group)

    this._buildDome()
    this._buildIslands()
    this._buildPetals()
  }

  _buildDome() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(this.pal.skyTop) },
        uMid: { value: new THREE.Color(this.pal.skyMid) },
        uHaze: { value: new THREE.Color(this.pal.skyHaze) },
        uBottom: { value: new THREE.Color(this.pal.skyBottom) },
        uAbyss: { value: new THREE.Color(this.pal.abyss) },
        uTime: { value: 0 },
        // Matches the DirectionalLight in Scene.js.
        uSunDir: { value: new THREE.Vector3(20, 17, 13).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize( position );
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uHaze;
        uniform vec3 uBottom;
        uniform vec3 uAbyss;
        uniform float uTime;
        uniform vec3 uSunDir;
        varying vec3 vDir;

        float hash( vec2 p ) {
          return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
        }

        void main() {
          float y = vDir.y;

          // Explicit bands rather than a two-colour lerp: a straight mix puts a
          // muddy midpoint exactly where the horizon is, which is the one place
          // that has to look luminous.
          // Above the horizon: haze rising into deep sky.
          vec3 col = mix( uHaze, uMid, smoothstep( 0.02, 0.34, y ) );
          col = mix( col, uTop, smoothstep( 0.30, 0.85, y ) );

          // Below the horizon we are looking over the edge of a floating plateau,
          // so this is not sky at all — it is the 운해, a sea of cloud sinking into
          // the abyss. Treating it as sky is what made the band read as flat sand.
          float d = clamp( -y, 0.0, 1.0 );
          vec3 below = mix( uBottom, uHaze, smoothstep( 0.0, 0.06, d ) );
          below = mix( below, uAbyss, smoothstep( 0.04, 0.42, d ) );

          // Layered cloud banding, drifting, so the void has depth instead of being
          // a flat wash.
          float bands = sin( d * 46.0 - uTime * 0.10 ) * 0.5 + 0.5;
          bands *= sin( d * 17.0 + uTime * 0.05 ) * 0.5 + 0.5;
          // The plateau rim sits around d≈0.34 from the play camera, so the cloud
          // layer has to survive well past that or it is never actually on screen.
          below += uHaze * bands * smoothstep( 0.75, 0.05, d ) * 0.22;

          col = mix( below, col, step( 0.0, y ) );

          // Warm rim of light right on the horizon line.
          col += uBottom * exp( -abs( y ) * 40.0 ) * 0.30;

          // Sparse stars, fading in with altitude so the haze stays clean.
          vec2 cell = floor( vDir.xz * 190.0 );
          float n = hash( cell );
          float twinkle = 0.75 + 0.25 * sin( uTime * 2.0 + n * 40.0 );
          col += vec3( smoothstep( 0.9972, 1.0, n ) * smoothstep( 0.18, 0.7, y ) * twinkle );

          // 서기 — faint auspicious light banding high in the sky.
          float band = sin( y * 9.0 - uTime * 0.06 ) * 0.5 + 0.5;
          col += uHaze * band * smoothstep( 0.45, 0.95, y ) * 0.05;

          // Cloud sheets, projected onto a plane above the dome and drifting.
          //
          // Summed sinusoids rather than any lattice noise: the same reason the
          // ground textures use them, and here it also costs four sines instead
          // of a hash and four fetches. A bare vertical gradient is the single
          // clearest sign that a sky is a backdrop rather than a place.
          if ( y > 0.015 ) {
            vec2 cuv = vDir.xz / max( 0.16, y ) * 0.55;
            cuv += vec2( uTime * 0.010, uTime * 0.006 );
            float c = sin( cuv.x * 1.7 + cuv.y * 0.9 ) * 0.50
                    + sin( cuv.x * -0.8 + cuv.y * 2.3 + 1.7 ) * 0.34
                    + sin( cuv.x * 3.1 + cuv.y * -1.4 + 3.1 ) * 0.21
                    + sin( cuv.x * 5.7 + cuv.y * 4.3 + 5.2 ) * 0.12;
            float cloud = smoothstep( 0.24, 0.80, c * 0.5 + 0.5 );
            // Thinning to nothing at the horizon keeps the haze band clean and
            // stops the projection stretching into streaks down there.
            cloud *= smoothstep( 0.015, 0.26, y ) * smoothstep( 1.05, 0.40, y );
            // Lit from the sun side, shaded away from it, so the sheets have a
            // form instead of being flat cut-outs pasted on the gradient.
            float lit = 0.5 + 0.5 * dot( normalize( vDir ), uSunDir );
            vec3 cloudCol = mix( uMid * 1.05, uHaze * 1.42, lit );
            col = mix( col, cloudCol, cloud * 0.80 );
          }

          // The sun, in the direction the key light actually comes from. A lit
          // scene whose sky has no light source in it always looks slightly
          // wrong even when nobody can say why.
          float sd = max( 0.0, dot( normalize( vDir ), uSunDir ) );
          col += uBottom * pow( sd, 1400.0 ) * 2.2;
          col += uBottom * pow( sd, 9.0 ) * 0.14;

          gl_FragColor = vec4( col, 1.0 );
        }`,
    })
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat)
    this.group.add(this.dome)
  }

  _buildIslands() {
    // Coloured top to bottom rather than left one flat grey. A distant island is
    // small on screen, but a single untextured tone at that size reads as a
    // placeholder rock — the green cap is what makes it land instead.
    const cap = buildColored([
      [roughen(new THREE.DodecahedronGeometry(6, 0), 0.5, 5), { y: 0, sy: 0.55 }, undefined],
      [roughen(new THREE.DodecahedronGeometry(2.4, 0), 0.3, 9), { x: 5.5, y: 0.8, sy: 0.6 }, undefined],
    ])
    gradient(cap, 0x4a5c62, 0x6f9a63, 'y')

    const root = roughen(new THREE.ConeGeometry(4.5, 11, 7), 0.45, 13)
    gradient(root, 0x222c36, 0x51666f, 'y')

    const geo = buildColored([
      [cap, {}, undefined],
      [root, { y: -6.2, rx: Math.PI }, undefined],
    ])
    const mat = makeToonMaterial({
      color: 0xffffff, rim: 0.5, rimColor: this.pal.skyHaze, fog: false, vertexColors: true,
    })
    this.islands = new THREE.InstancedMesh(geo, mat, ISLAND_COUNT)
    this.islandBase = []
    // Kept low and close: in a 3/4 view only a narrow band of sky is ever on
    // screen, so islands placed high would never be seen.
    for (let i = 0; i < ISLAND_COUNT; i++) {
      const a = (i / ISLAND_COUNT) * Math.PI * 2 + 0.6
      const r = 110 + Math.random() * 70
      this.islandBase.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        // Above the camera's eye line (y=22) so they clear the horizon; anything
        // lower is hidden behind the plateau rim.
        y: 26 + Math.random() * 14,
        s: 1.2 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
      })
    }
    this.group.add(this.islands)
    // Place them immediately: an InstancedMesh starts at identity, which would
    // stack every island on top of the player for the first rendered frame.
    this._placeIslands(0, 0)
  }

  _placeIslands(playerX, playerZ) {
    for (let i = 0; i < ISLAND_COUNT; i++) {
      const b = this.islandBase[i]
      _dummy.position.set(
        playerX + b.x,
        b.y + Math.sin(this.time * 0.18 + b.phase) * 2.2,
        playerZ + b.z,
      )
      _dummy.rotation.set(0, this.time * 0.02 + b.phase, 0)
      _dummy.scale.setScalar(b.s)
      _dummy.updateMatrix()
      this.islands.setMatrixAt(i, _dummy.matrix)
    }
    this.islands.instanceMatrix.needsUpdate = true
  }

  _buildPetals() {
    const base = new THREE.PlaneGeometry(0.34, 0.5)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.attributes = base.attributes

    const seeds = new Float32Array(PETAL_COUNT * 3)
    for (let i = 0; i < PETAL_COUNT; i++) {
      seeds[i * 3 + 0] = Math.random()
      seeds[i * 3 + 1] = Math.random()
      seeds[i * 3 + 2] = Math.random()
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3))
    geo.instanceCount = PETAL_COUNT

    this.petalMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      // Embers rise and glow; petals and snow fall and do not. Everything else
      // about the drift is shared, so the stage only picks a shape and a tint.
      blending: this.pal.moteRise ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uMap: { value: this.pal.mote === 'spark' ? moteTexture() : petalTexture() },
        uTint: { value: new THREE.Color(this.pal.moteTint ?? 0xffffff) },
        uRise: { value: this.pal.moteRise ? 1 : 0 },
        uBox: { value: PETAL_BOX },
      },
      vertexShader: `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform vec3 uCenter;
        uniform float uBox;
        uniform float uRise;
        varying vec2 vUv;
        varying float vFade;

        void main() {
          vUv = uv;

          float fall = 1.4 + aSeed.z * 1.6;
          // Deliberately not named "half" - that is a reserved word in GLSL and
          // silently kills the whole shader.
          float halfBox = uBox * 0.5;

          // Wrap each petal inside a box that travels with the player.
          float px = mod( aSeed.x * uBox + sin( uTime * 0.25 + aSeed.y * 20.0 ) * 6.0, uBox ) - halfBox;
          float pz = mod( aSeed.y * uBox + uTime * 1.1, uBox ) - halfBox;
          float drift = uRise > 0.5 ? uTime * fall * 0.55 : -uTime * fall;
          float py = mod( aSeed.z * 34.0 + drift, 34.0 );

          vec3 world = uCenter + vec3( px, py + 0.5, pz );

          // Billboard toward the camera, with a per-petal tumble.
          float spin = uTime * ( 0.7 + aSeed.x * 1.5 ) + aSeed.y * 6.28;
          vec3 right = vec3( cos( spin ), 0.0, sin( spin ) );
          vec3 up = normalize( vec3( sin( spin ) * 0.4, 1.0, cos( spin ) * 0.4 ) );
          vec3 offset = right * position.x + up * position.y;

          vFade = smoothstep( 0.0, 4.0, py ) * smoothstep( 34.0, 26.0, py );
          gl_Position = projectionMatrix * viewMatrix * vec4( world + offset, 1.0 );
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uTint;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          vec4 tex = texture2D( uMap, vUv );
          gl_FragColor = vec4( tex.rgb * uTint, tex.a * vFade * 0.85 );
          if ( gl_FragColor.a < 0.01 ) discard;
        }`,
    })

    this.petals = new THREE.Mesh(geo, this.petalMat)
    this.petals.frustumCulled = false
    this.group.add(this.petals)
  }

  update(dt, playerX, playerZ) {
    this.time += dt

    this.dome.position.set(playerX, 0, playerZ)
    this.dome.material.uniforms.uTime.value = this.time
    this.petalMat.uniforms.uTime.value = this.time
    this.petalMat.uniforms.uCenter.value.set(playerX, 0, playerZ)

    this._placeIslands(playerX, playerZ)
  }

  dispose() {
    this.scene.remove(this.group)
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) o.material.dispose()
    })
  }
}
