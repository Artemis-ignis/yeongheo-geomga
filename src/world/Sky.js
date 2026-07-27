import * as THREE from 'three'
import { makeToonMaterial, PALETTE } from '../art/materials.js'
import { buildMerged } from '../art/geometry.js'
import { petalTexture } from '../art/textures.js'

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
  constructor(scene) {
    this.scene = scene
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
        uTop: { value: new THREE.Color(PALETTE.skyTop) },
        uMid: { value: new THREE.Color(PALETTE.skyMid) },
        uHaze: { value: new THREE.Color(PALETTE.skyHaze) },
        uBottom: { value: new THREE.Color(PALETTE.skyBottom) },
        uAbyss: { value: new THREE.Color(PALETTE.abyss) },
        uTime: { value: 0 },
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

          // 서기(瑞氣) — faint auspicious light banding high in the sky.
          float band = sin( y * 9.0 - uTime * 0.06 ) * 0.5 + 0.5;
          col += uHaze * band * smoothstep( 0.45, 0.95, y ) * 0.05;

          gl_FragColor = vec4( col, 1.0 );
        }`,
    })
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat)
    this.group.add(this.dome)
  }

  _buildIslands() {
    const geo = buildMerged([
      [new THREE.DodecahedronGeometry(6, 0), { y: 0, sy: 0.55 }],
      [new THREE.ConeGeometry(4.5, 9, 6), { y: -5.5, rx: Math.PI }],
      [new THREE.DodecahedronGeometry(2.4, 0), { x: 5.5, y: 0.8, sy: 0.6 }],
    ])
    const mat = makeToonMaterial({ color: 0x53707f, rim: 0.5, rimColor: PALETTE.mist, fog: false })
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
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uMap: { value: petalTexture() },
        uBox: { value: PETAL_BOX },
      },
      vertexShader: `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform vec3 uCenter;
        uniform float uBox;
        varying vec2 vUv;
        varying float vFade;

        void main() {
          vUv = uv;

          float fall = 1.4 + aSeed.z * 1.6;
          float half = uBox * 0.5;

          // Wrap each petal inside a box that travels with the player.
          float px = mod( aSeed.x * uBox + sin( uTime * 0.25 + aSeed.y * 20.0 ) * 6.0, uBox ) - half;
          float pz = mod( aSeed.y * uBox + uTime * 1.1, uBox ) - half;
          float py = mod( aSeed.z * 34.0 - uTime * fall, 34.0 );

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
        varying vec2 vUv;
        varying float vFade;
        void main() {
          vec4 tex = texture2D( uMap, vUv );
          gl_FragColor = vec4( tex.rgb, tex.a * vFade * 0.85 );
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

  dispose() {
    this.scene.remove(this.group)
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) o.material.dispose()
    })
  }
}
