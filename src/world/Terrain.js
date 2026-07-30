import * as THREE from 'three'
import { makeToonMaterial, PALETTE } from '../art/materials.js'
import { barrierTexture, groundTexture, groundNormalTexture, mistTexture } from '../art/textures.js'
import { buildMerged } from '../art/geometry.js'
import { buildColored, gradient, roughen } from '../art/shapeKit.js'

/** Lighten or darken a hex by a factor, for cheap tonal variants of a palette. */
function shade(hex, factor) {
  const c = new THREE.Color(hex)
  c.r = Math.min(1, c.r * factor)
  c.g = Math.min(1, c.g * factor)
  c.b = Math.min(1, c.b * factor)
  return c.getHex()
}

export const ARENA_RADIUS = 36
/** The plateau extends past the 결계 so the drop into the void is visible at the rim. */
export const PLATEAU_RADIUS = 48

const CLAMP_RADIUS = ARENA_RADIUS - 1.0
const MAX_PINGS = 4
const PING_LIFE = 0.6
const CLEARING_RADIUS = 10

const _dummy = new THREE.Object3D()

/**
 * The 비경 arena: jade ground, a 결계 barrier ring, and scattered scenery.
 *
 * Props are purely decorative — collision with scenery is miserable in a horde
 * game, so nothing here blocks movement except the barrier itself.
 */
export class Terrain {
  constructor(scene, palette = {}) {
    this.scene = scene
    this.pal = {
      ground: PALETTE.jadeDark, groundMoss: 0x96d696, pine: PALETTE.pine,
      stone: PALETTE.stone, barrier: 0x8fd8ff, ...palette,
    }
    this.time = 0

    // Ping ring buffer: angle + remaining life, preallocated so contact allocates nothing.
    this.pingAngle = new Float32Array(MAX_PINGS)
    this.pingLife = new Float32Array(MAX_PINGS)
    this.pingNext = 0

    this.group = new THREE.Group()
    scene.add(this.group)

    this._buildGround()
    this._buildBarrier()
    this._buildMist()
    this._buildProps()
  }

  /**
   * Low-frequency tonal variation baked into the disc's vertex colours.
   *
   * The albedo has to tile to stay sharp at this scale, and anything that tiles
   * announces itself however carefully the seams are hidden — patches of light
   * and shade recur on a fixed grid and the eye locks onto it. This is the one
   * layer that cannot repeat, because it is painted per-vertex across the whole
   * plateau exactly once. It carries the broad shading; the tiled map carries
   * the grain.
   */
  _paintMacro(geo) {
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    // Deterministic: the arena must look the same every run of the same stage.
    let seed = 9176
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    // A handful of smooth blobs at different scales, summed.
    const waves = []
    for (let i = 0; i < 7; i++) {
      waves.push({
        fx: (rnd() - 0.5) * 0.24, fy: (rnd() - 0.5) * 0.24,
        phase: rnd() * Math.PI * 2, amp: 0.16 / (1 + i * 0.55),
      })
    }
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      let n = 0
      for (const w of waves) n += Math.sin(x * w.fx + y * w.fy + w.phase) * w.amp
      const k = 1 + n
      colors[i * 3] = k
      colors[i * 3 + 1] = k
      colors[i * 3 + 2] = k
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }

  _buildGround() {
    // A finite disc, not an infinite plane — the arena is a floating plateau, and
    // seeing its edge drop into the void is what sells that.
    //
    // A ring rather than a circle purely so it has interior vertices: the macro
    // shading below needs somewhere to live. CircleGeometry is a fan with a
    // single centre vertex and nothing in between.
    const geo = new THREE.RingGeometry(0.03, PLATEAU_RADIUS, 96, 22)
    const tex = groundTexture(this.pal.ground, this.pal.groundMoss, this.pal.groundVein ?? 0)
    // The normal map is what makes the surface catch light; without it the ground
    // is a painted plane however detailed the albedo gets.
    const mat = makeToonMaterial({
      color: 0xffffff,
      rim: 0,
      map: tex,
      normalMap: groundNormalTexture(),
      normalScale: new THREE.Vector2(0.85, 0.85),
      vertexColors: true,
    })
    this._paintMacro(geo)
    this.ground = new THREE.Mesh(geo, mat)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true
    this.group.add(this.ground)

    // The rock mass hanging below the plateau, tapering to a point. Open-ended and
    // dropped clear of y=0 — a capped cylinder there would z-fight with the ground.
    const underside = buildMerged([
      [new THREE.CylinderGeometry(PLATEAU_RADIUS, PLATEAU_RADIUS * 0.86, 6, 64, 1, true), { y: -3.1 }],
      [new THREE.ConeGeometry(PLATEAU_RADIUS * 0.86, 34, 48), { y: -23.1, rx: Math.PI }],
    ])
    this.underside = new THREE.Mesh(
      underside,
      makeToonMaterial({ color: 0x4a5a55, rim: 0.35, rimColor: PALETTE.mist, flatShading: true }),
    )
    this.group.add(this.underside)
  }

  _buildBarrier() {
    const tex = barrierTexture()
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(30, 1)
    this.barrierTex = tex

    const geo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 11, 96, 1, true)
    // Fade the ward out with height. It stands eleven units tall, so from the
    // play camera the far wall crossed the horizon and its hexagons read as a
    // technical pattern floating in the sky rather than as a barrier standing on
    // the ground. Additive blending means black is invisible, so a vertex
    // gradient to black is all this needs.
    const bpos = geo.attributes.position
    const bcol = new Float32Array(bpos.count * 3)
    for (let i = 0; i < bpos.count; i++) {
      // Local y runs -5.5 to 5.5 before the mesh is lifted.
      const t = (bpos.getY(i) + 5.5) / 11
      const k = Math.max(0, 1 - t * t * 1.55)
      bcol[i * 3] = k
      bcol[i * 3 + 1] = k
      bcol[i * 3 + 2] = k
    }
    geo.setAttribute('color', new THREE.BufferAttribute(bcol, 3))

    this.barrierMat = new THREE.MeshBasicMaterial({
      map: tex,
      color: this.pal.barrier,
      vertexColors: true,
      transparent: true,
      // Deliberately faint: standing next to it the wall fills a lot of screen,
      // and with bloom on top it must never compete with the enemies.
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      // BackSide, not DoubleSide: the near wall would otherwise be drawn between
      // the camera and the arena, blanketing the whole playfield in hexagons.
      side: THREE.BackSide,
    })
    this.barrier = new THREE.Mesh(geo, this.barrierMat)
    this.barrier.position.y = 5.5
    this.group.add(this.barrier)

    // A brighter arc that follows the most recent contact point.
    const arcGeo = new THREE.CylinderGeometry(ARENA_RADIUS - 0.05, ARENA_RADIUS - 0.05, 11, 24, 1, true, 0, 0.7)
    this.arcMat = new THREE.MeshBasicMaterial({
      map: tex,
      color: 0xd8f4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    })
    this.arc = new THREE.Mesh(arcGeo, this.arcMat)
    this.arc.position.y = 5.5
    this.group.add(this.arc)
  }

  _buildMist() {
    this.mistTex = mistTexture()
    const mat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: PALETTE.mist,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    // Static disc rather than a player-following plane, so it can never overhang
    // the plateau edge and float in the void.
    this.mist = new THREE.Mesh(new THREE.CircleGeometry(PLATEAU_RADIUS - 1, 64), mat)
    this.mist.rotation.x = -Math.PI / 2
    this.mist.position.y = 0.4
    this.group.add(this.mist)
  }

  /** Rejection-sampled scatter: no overlaps, and a clear ring around spawn. */
  _scatter(count, minGap, maxRadius) {
    const points = []
    let guard = 0
    while (points.length < count && guard < count * 60) {
      guard++
      const a = Math.random() * Math.PI * 2
      const r = CLEARING_RADIUS + Math.sqrt(Math.random()) * (maxRadius - CLEARING_RADIUS)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      let ok = true
      for (const p of points) {
        if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < minGap * minGap) { ok = false; break }
      }
      if (ok) points.push([x, z])
    }
    return points
  }

  /**
   * Three rock shapes rather than one.
   *
   * A single dodecahedron instanced thirty-four times is thirty-four copies of
   * the same silhouette scattered around the rim, and the eye finds that
   * repetition immediately — more so than it notices any individual rock being
   * simple. Variants cost two extra draw calls.
   */
  _rockVariants() {
    const dark = shade(this.pal.stone, 0.55)
    const light = shade(this.pal.stone, 1.35)

    // A weathered boulder: rounded, lighter where the sky hits the top.
    const boulder = roughen(new THREE.DodecahedronGeometry(1, 0), 0.16, 3)
    gradient(boulder, dark, light, 'y')

    // A split shard, tilted, with a flat cleaved face.
    const shard = buildColored([
      [roughen(new THREE.ConeGeometry(0.85, 2.1, 5), 0.13, 7), { y: 0.6, rz: 0.26 }, undefined],
      [roughen(new THREE.DodecahedronGeometry(0.5, 0), 0.1, 11), { x: 0.6, y: -0.35 }, dark],
    ])
    gradient(shard, dark, light, 'y')

    // A stack, which reads as several stones settled together.
    const stack = buildColored([
      [roughen(new THREE.DodecahedronGeometry(0.9, 0), 0.14, 13), { y: -0.35, sy: 0.7 }, undefined],
      [roughen(new THREE.DodecahedronGeometry(0.62, 0), 0.12, 17), { x: 0.2, y: 0.45, sy: 0.8 }, undefined],
      [roughen(new THREE.DodecahedronGeometry(0.34, 0), 0.1, 19), { x: -0.15, y: 1.05 }, undefined],
    ])
    gradient(stack, dark, light, 'y')

    return [boulder, shard, stack]
  }

  /**
   * Tiered conifers. The old pine was two cones on a stick — the Christmas-tree
   * shape, which reads as a placeholder. Real conifer silhouettes are a stack of
   * skirts that narrow going up, and the notches between them are what make the
   * outline read as foliage rather than as a triangle.
   */
  _pineVariants() {
    const deep = shade(this.pal.pine, 0.62)
    const bright = shade(this.pal.pine, 1.42)
    const bark = shade(this.pal.pine, 0.5)

    const build = (tiers, height, spread, lean) => {
      const parts = [[
        new THREE.CylinderGeometry(0.13, 0.2, height * 0.42, 6),
        { y: height * 0.21 }, bark,
      ]]
      for (let i = 0; i < tiers; i++) {
        const t = i / (tiers - 1)
        const r = spread * (1 - t * 0.72)
        const y = height * (0.3 + t * 0.62)
        const h = height * (0.34 - t * 0.1)
        const skirt = new THREE.ConeGeometry(r, h, 8)
        gradient(skirt, deep, bright, 'y')
        parts.push([skirt, {
          y: y + h * 0.3,
          x: Math.sin(i * 2.1) * lean * 0.16,
          rz: lean * 0.06,
        }, undefined])
      }
      return buildColored(parts)
    }

    return [
      build(5, 5.4, 1.15, 0.4),
      build(6, 6.8, 0.95, -0.7),
      build(4, 4.2, 1.3, 0.2),
    ]
  }

  _buildProps() {
    const rockMat = makeToonMaterial({ color: 0xffffff, rim: 0.2, vertexColors: true })
    // Rocks spill past the 결계 onto the outer rim so the plateau has a silhouette.
    // Kept sparse inside the arena: scenery must never hide an incoming enemy.
    const rocks = this._scatter(46, 6, PLATEAU_RADIUS - 3)
    const rockGeos = this._rockVariants()
    // Props cast now. With the key light low in the sky these throw long
    // shadows across the plateau, which is most of what gives a flat disc of
    // ground any sense of depth — and they are a handful of merged draws, not
    // the horde, so the shadow pass can afford them.
    this.rocks = rockGeos.map((geo) => {
      const mesh = new THREE.InstancedMesh(geo, rockMat, rocks.length)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.count = 0
      this.group.add(mesh)
      return mesh
    })
    rocks.forEach(([x, z]) => {
      // Inside the 결계 a rock must stay well under head height — anything taller
      // can park itself between the camera and the player and hide her entirely.
      // Past the barrier there is no gameplay to occlude, so they can be boulders.
      const d = Math.hypot(x, z)
      const rim = Math.min(1, Math.max(0, (d - ARENA_RADIUS) / (PLATEAU_RADIUS - ARENA_RADIUS)))
      const s = 0.30 + Math.random() * (0.22 + rim * 2.2)
      // Shards and stacks are tall, so they only go out past the barrier.
      const variant = rim > 0.15 ? Math.floor(Math.random() * 3) : 0
      const mesh = this.rocks[variant]
      _dummy.position.set(x, s * 0.35, z)
      _dummy.rotation.set(
        variant === 0 ? Math.random() * 3 : Math.random() * 0.25,
        Math.random() * 6.28,
        variant === 0 ? Math.random() * 3 : Math.random() * 0.25,
      )
      _dummy.scale.set(s, s * (0.7 + Math.random() * 0.5), s)
      _dummy.updateMatrix()
      mesh.setMatrixAt(mesh.count++, _dummy.matrix)
    })
    for (const m of this.rocks) m.instanceMatrix.needsUpdate = true

    const pineMat = makeToonMaterial({ color: 0xffffff, rim: 0.25, rimColor: 0x9be8c8, vertexColors: true })
    // Kept to the outer ring: with the camera this close, a pine anywhere near
    // the player fills a third of the screen and hides the fight behind it.
    const pines = this._scatter(40, 6, PLATEAU_RADIUS - 3).filter(([x, z]) => Math.hypot(x, z) > ARENA_RADIUS * 0.92)
    const pineGeos = this._pineVariants()
    this.pines = pineGeos.map((geo) => {
      const mesh = new THREE.InstancedMesh(geo, pineMat, pines.length)
      mesh.castShadow = true
      mesh.count = 0
      this.group.add(mesh)
      return mesh
    })
    pines.forEach(([x, z]) => {
      const mesh = this.pines[Math.floor(Math.random() * this.pines.length)]
      const s = 0.7 + Math.random() * 0.7
      _dummy.position.set(x, 0, z)
      _dummy.rotation.set(0, Math.random() * Math.PI * 2, 0)
      _dummy.scale.set(s, s * (0.85 + Math.random() * 0.5), s)
      _dummy.updateMatrix()
      mesh.setMatrixAt(mesh.count++, _dummy.matrix)
    })
    for (const m of this.pines) m.instanceMatrix.needsUpdate = true

    // Stone lanterns: a small stack topped with a light box and a pyramid cap.
    const lanternGeo = buildMerged([
      [new THREE.CylinderGeometry(0.42, 0.5, 0.5, 8), { y: 0.25 }],
      [new THREE.CylinderGeometry(0.16, 0.16, 1.1, 8), { y: 1.05 }],
      [new THREE.BoxGeometry(0.62, 0.62, 0.62), { y: 1.9 }],
      [new THREE.ConeGeometry(0.62, 0.42, 4), { y: 2.42 }],
    ])
    const lanternMat = makeToonMaterial({ color: 0x9a927f, rim: 0.5, rimColor: PALETTE.gold })
    // Lanterns are tall, so they belong on the rim with the pines.
    const lanterns = this._scatter(10, 12, PLATEAU_RADIUS - 3).filter(([x, z]) => Math.hypot(x, z) > ARENA_RADIUS * 0.85)
    this.lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, lanterns.length)
    lanterns.forEach(([x, z], i) => {
      _dummy.position.set(x, 0, z)
      _dummy.rotation.set(0, Math.random() * Math.PI * 2, 0)
      _dummy.scale.setScalar(1)
      _dummy.updateMatrix()
      this.lanterns.setMatrixAt(i, _dummy.matrix)
    })
    this.lanterns.instanceMatrix.needsUpdate = true
    this.group.add(this.lanterns)
  }

  /** Record a barrier contact so the wall lights up where it was touched. */
  pingBarrier(x, z) {
    const i = this.pingNext % MAX_PINGS
    this.pingAngle[i] = Math.atan2(x, z)
    this.pingLife[i] = PING_LIFE
    this.pingNext++
  }

  /**
   * Push a point back inside the 결계. Mutates `point.x`/`point.z`.
   * Returns true when it actually clamped.
   */
  clampToArena(point) {
    const d = Math.hypot(point.x, point.z)
    if (d <= CLAMP_RADIUS) return false
    const k = CLAMP_RADIUS / d
    point.x *= k
    point.z *= k
    this.pingBarrier(point.x, point.z)
    return true
  }

  update(dt, playerX, playerZ) {
    this.time += dt

    this.barrierTex.offset.y = (this.time * 0.05) % 1
    this.mistTex.offset.x = (this.time * 0.012) % 1
    this.mistTex.offset.y = (this.time * 0.008) % 1

    // Show the freshest live ping; the others just decay.
    let best = -1
    let bestLife = 0
    for (let i = 0; i < MAX_PINGS; i++) {
      if (this.pingLife[i] <= 0) continue
      this.pingLife[i] = Math.max(0, this.pingLife[i] - dt)
      if (this.pingLife[i] > bestLife) { bestLife = this.pingLife[i]; best = i }
    }
    if (best === -1) {
      this.arcMat.opacity = 0
    } else {
      this.arcMat.opacity = (bestLife / PING_LIFE) * 0.75
      this.arc.rotation.y = -this.pingAngle[best] - 0.35
    }
  }

  dispose() {
    this.scene.remove(this.group)
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) o.material.dispose()
    })
  }
}
