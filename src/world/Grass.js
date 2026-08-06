import * as THREE from 'three'

/**
 * Blades in the tile that follows the player.
 *
 * This used to be 92,000 scattered across the whole 46-unit plateau, on the
 * reasoning that the count has to carry the arena because the player walks all
 * of it, and that it is one instanced draw either way. One draw call, yes —
 * but 276,000 triangles of it, every frame, which measured at 73% of the entire
 * scene. And with the camera seeing a 27-unit radius, 65.6% of those blades
 * were drawn while standing dead centre and never seen once. From the rim it is
 * worse.
 *
 * The field is now a square tile that wraps around the player in the vertex
 * shader, so the blades are always exactly where the camera is looking and the
 * count only has to cover one screen instead of the whole arena. Density per
 * square metre is *higher* than before; there is simply no longer a majority of
 * the field being rasterised out of frame.
 */
// The close clearing hides most of the field in the gameplay camera. 28k
// authored blades (about 20k on the jade stage) keep the silhouette lush while
// removing roughly a third of the vertex work from integrated GPUs.
const BASE_BLADE_COUNT = 28000

/**
 * Side of the tile the blades are authored in.
 *
 * The tile the shader actually wraps at is a uniform, because the camera can now
 * zoom: at 1.9x the view radius outruns any fixed tile and its seam walks across
 * the ground as a hard edge of grass. `setView` rescales the wrap to the frustum
 * instead, so there is no zoom level at which the seam can be reached. Blades
 * keep their authored size and their tufts keep their authored spread; only the
 * spacing between tufts opens up, which is the right trade — zoomed out,
 * everything is smaller on screen anyway.
 */
const TILE_BUILD = 60

/** Tile side as a multiple of the view radius. Above 2 the seam is off-screen. */
const TILE_TO_VIEW = 2.2

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
    const clearing = opts.clearing ?? CLEARING
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
    while (placed < bladeCount) {
      // Scattered over the tile, not the plateau. The shader wraps this into
      // place around the player, so a uniform square is what is wanted here —
      // any radial structure would slide about as she walks.
      const cx = (Math.random() - 0.5) * TILE_BUILD
      const cz = (Math.random() - 0.5) * TILE_BUILD
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
        // Blades in one tuft share a vigour so a clump reads as one plant rather
        // than as strangers standing close together. The rim-is-taller term that
        // used to be baked in here has moved into the shader, which is the only
        // place that now knows where a blade actually stands.
        seed[placed * 3 + 2] = vigour * (0.72 + Math.random() * 0.5)
        placed++
      }
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3))
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 3))
    geo.instanceCount = placed
    this.fullCount = placed

    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uPlayer: { value: new THREE.Vector3() },
        uTileSize: { value: TILE_BUILD },
        uTileBuild: { value: TILE_BUILD },
        uOuter: { value: outerRadius },
        uClearing: { value: clearing },
        uBase: { value: new THREE.Color(pal.grassBase ?? 0x2f6b4f) },
        /**
         * The authored tip colour, pulled 45% of the way back to the base.
         *
         * Every 비경 names a bright tip so a blade has a gradient along its
         * length, and at full strength that gradient is also the contrast
         * between the blade and the floor behind it — 92,000 bright shapes on a
         * dark plane, which is what made the field read as static rather than
         * as ground. Blending toward the base keeps the gradient and drops the
         * contrast; the palettes stay authored the way they read in the file.
         */
        uTip: {
          value: new THREE.Color(pal.grassTip ?? 0x9fd88a)
            .lerp(new THREE.Color(pal.grassBase ?? 0x2f6b4f), 0.45),
        },
        uFogColor: { value: new THREE.Color(pal.fog ?? 0x9db9c9) },
        uFogDensity: { value: 0.0085 },
        /**
         * Per-blade brightness spread and hue drift, kept at their original
         * values because measuring them disproved the obvious theory.
         *
         * The field is by far the loudest thing on screen: hiding it takes a
         * mid-run frame from 0.0352 to 0.0194 on `__tone().detail`, the mean
         * luminance step between adjacent pixels. Forty-five percent of the
         * picture's busyness is grass, against 0.001 to 0.002 for every enemy,
         * pickup and projectile put together.
         *
         * The obvious culprit was this: 92,000 blades each lit to a random
         * 55-100% brightness with an independent hue. Swept, it goes the other
         * way — 0.45 spread reads 0.0342 and no spread at all reads 0.0393.
         * Variance is not the noise; blade-against-ground contrast is, and a
         * wide spread darkens enough blades that they sink into the floor. The
         * lever is `uContact` below.
         */
        uShadeSpread: { value: 0.45 },
        uTintDrift: { value: 0.24 },
        /**
         * How deeply a blade is darkened toward its base so it sits *in* the
         * ground rather than on it. This is the contrast control: it decides how
         * much of every blade is close to the floor's own value, which is what
         * stops 92,000 bright shapes on a dark plane from reading as static.
         */
        uContact: { value: 0.62 },
        /**
         * How far up the blade that darkening reaches. 0.75 rather than the
         * original 0.30: the higher it goes, the more of each blade sits near
         * the floor's own value and the less every blade edge costs.
         */
        uContactHeight: { value: 0.75 },
        /**
         * Pulls the field toward its own luminance.
         *
         * Calming the blade-to-ground contrast had a side effect worth naming:
         * with the bright tips pulled back, nearly every pixel of ground became
         * the one deeply saturated base green, and the frame measured 0.98 mean
         * saturation — above even the 0.97 ceiling. Quiet and garish at once.
         * The field is the largest object in the game and does not need to be
         * the most colourful thing in it.
         */
        uSaturation: { value: 0.78 },
      },
      vertexShader: `
        attribute vec3 aOffset;
        attribute vec3 aSeed;
        attribute float aHeight;
        uniform float uTime;
        uniform float uShadeSpread;
        uniform vec3 uPlayer;
        uniform float uTileSize;
        uniform float uTileBuild;
        uniform float uOuter;
        uniform float uClearing;
        varying float vH;
        varying float vShade;
        varying float vTint;
        varying float vFogDepth;

        void main() {
          vH = aHeight;

          // Wrap the tile so it is always centred on the player.
          //
          // This is the whole reason the field costs a third of what it did: the
          // blades follow the camera instead of being scattered over an arena
          // whose majority is off-screen at any moment. The wrap is done on the
          // tuft's own origin rather than per blade, so a clump that crosses the
          // seam travels intact instead of being torn in half.
          // The tuft's origin is wrapped; the blade's offset within its tuft is
          // added afterwards at its authored size, so a clump that crosses the
          // seam travels intact and never stretches with the zoom.
          vec2 anchor = floor( aOffset.xz / uTileBuild + 0.5 ) * uTileBuild;
          vec2 tuftO = aOffset.xz - anchor;
          vec2 spread = anchor * ( uTileSize / uTileBuild );
          vec2 base = mod( spread - uPlayer.xz + uTileSize * 0.5, uTileSize )
                    - uTileSize * 0.5 + uPlayer.xz;
          vec2 root = base + tuftO;

          // Where the blade actually stands decides how it grows: taller out on
          // the rim where nothing has trampled it, gone entirely off the plateau
          // and in the clearing at the centre. Baking this in at build time is
          // no longer possible now that a blade does not keep one position.
          float rad = length( root );
          float scale = aSeed.z * ( 0.6 + clamp( rad / uOuter, 0.0, 1.0 ) * 0.8 );
          scale *= smoothstep( uOuter, uOuter - 3.0, rad );
          scale *= smoothstep( uClearing - 1.2, uClearing, rad );

          // Rotate each blade to its own facing so the field is not all aligned.
          float rot = aSeed.x * 6.2831;
          float cr = cos( rot ), sr = sin( rot );
          vec3 p = vec3( position.x * cr, position.y, position.x * sr );
          // Collapse a culled blade completely. Scaling only the height would
          // leave its full width lying flat on the ground as a visible sliver.
          p *= vec3( step( 0.001, scale ) );
          p.y *= scale;

          vec3 world = vec3( root.x, 0.0, root.y ) + p;

          // Wind: two waves at different scales, only affecting the upper blade.
          // Driven by the blade's world position, not its position within the
          // tile — otherwise the whole wind pattern would travel with the player
          // and the field would look like it was breathing in step with her.
          float bend = aHeight * aHeight;
          float wind = sin( uTime * 1.6 + root.x * 0.25 + aSeed.y * 6.28 ) * 0.16
                     + sin( uTime * 3.1 + root.y * 0.4 ) * 0.06;
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

          vShade = ( 1.0 - uShadeSpread ) + aSeed.y * uShadeSpread;
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
        uniform float uTintDrift;
        uniform float uContact;
        uniform float uContactHeight;
        uniform float uSaturation;
        varying float vH;
        varying float vShade;
        varying float vTint;
        varying float vFogDepth;

        void main() {
          vec3 col = mix( uBase, uTip, vH * vH ) * vShade;

          // Per-blade hue drift, warm one way and cool the other. A field where
          // every blade is the same two colours reads as one painted surface
          // however many blades are in it.
          col.r *= 1.0 - uTintDrift + vTint * uTintDrift * 2.0;
          col.b *= 1.0 + uTintDrift - vTint * uTintDrift * 2.0;

          // Darken sharply at the very base so blades sink into the ground
          // instead of sitting on top of it like cut-outs. This contact shading
          // is doing the job an ambient occlusion pass would, for free.
          col *= ( 1.0 - uContact ) + uContact * smoothstep( 0.0, uContactHeight, vH );

          // Ease the field off its own hue. See uSaturation.
          col = mix( vec3( dot( col, vec3( 0.2126, 0.7152, 0.0722 ) ) ), col, uSaturation );

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

  /**
   * Size the wrapping tile to what the camera can actually see.
   *
   * Called on resize and whenever the player zooms. `viewRadius` is measured at
   * zoom 1 by design — it sets the enemy spawn ring and must not move with a
   * view preference — so the zoom has to be multiplied back in here, or zooming
   * out would walk the tile seam into frame.
   */
  setView(viewRadius, zoom = 1) {
    this.material.uniforms.uTileSize.value = Math.max(
      TILE_BUILD * 0.5, viewRadius * zoom * TILE_TO_VIEW,
    )
  }

  /**
   * Thin the field on a machine that cannot afford all of it.
   *
   * Measured, GPU cost is linear in the blade count, so this is the one lever
   * that buys frames proportionally. It needs no reshuffle and allocates
   * nothing: the blades were written to the buffer in random order, so any
   * prefix of it is already a uniform random subset of the field. Tufts stay
   * whole because a tuft is seven consecutive entries.
   */
  setDensityScale(fraction) {
    const f = Math.max(0.15, Math.min(1, fraction))
    const tufts = Math.max(1, Math.round((this.fullCount * f) / TUFT_SIZE))
    this.mesh.geometry.instanceCount = Math.min(this.fullCount, tufts * TUFT_SIZE)
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.mesh.removeFromParent()
  }
}
