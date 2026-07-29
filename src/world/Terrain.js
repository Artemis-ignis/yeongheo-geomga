import * as THREE from 'three'
import { makeToonMaterial, PALETTE } from '../art/materials.js'
import { barrierTexture, groundTexture, groundNormalTexture, mistTexture } from '../art/textures.js'
import { buildMerged } from '../art/geometry.js'

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
  constructor(scene) {
    this.scene = scene
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

  _buildGround() {
    // A finite disc, not an infinite plane — the arena is a floating plateau, and
    // seeing its edge drop into the void is what sells that.
    const geo = new THREE.CircleGeometry(PLATEAU_RADIUS, 96)
    const tex = groundTexture()
    // The normal map is what makes the surface catch light; without it the ground
    // is a painted plane however detailed the albedo gets.
    const mat = makeToonMaterial({
      color: 0xffffff,
      rim: 0,
      map: tex,
      normalMap: groundNormalTexture(),
      normalScale: new THREE.Vector2(0.85, 0.85),
    })
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
    this.barrierMat = new THREE.MeshBasicMaterial({
      map: tex,
      color: 0x8fd8ff,
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

  _buildProps() {
    const rockGeo = new THREE.DodecahedronGeometry(1, 0)
    const rockMat = makeToonMaterial({ color: PALETTE.stone, rim: 0.2 })
    // Rocks spill past the 결계 onto the outer rim so the plateau has a silhouette.
    // Kept sparse inside the arena: scenery must never hide an incoming enemy.
    const rocks = this._scatter(34, 6, PLATEAU_RADIUS - 3)
    this.rocks = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length)
    this.rocks.castShadow = false
    this.rocks.receiveShadow = true
    rocks.forEach(([x, z], i) => {
      // Inside the 결계 a rock must stay well under head height — anything taller
      // can park itself between the camera and the player and hide her entirely.
      // Past the barrier there is no gameplay to occlude, so they can be boulders.
      const d = Math.hypot(x, z)
      const rim = Math.min(1, Math.max(0, (d - ARENA_RADIUS) / (PLATEAU_RADIUS - ARENA_RADIUS)))
      const s = 0.30 + Math.random() * (0.22 + rim * 2.2)
      _dummy.position.set(x, s * 0.35, z)
      _dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      _dummy.scale.set(s, s * (0.7 + Math.random() * 0.5), s)
      _dummy.updateMatrix()
      this.rocks.setMatrixAt(i, _dummy.matrix)
    })
    this.rocks.instanceMatrix.needsUpdate = true
    this.group.add(this.rocks)

    // Pine: two cone canopies over a trunk, merged so one instance is one draw.
    const pineGeo = buildMerged([
      [new THREE.CylinderGeometry(0.16, 0.22, 1.6, 6), { y: 0.8 }],
      [new THREE.ConeGeometry(1.05, 3.0, 7), { y: 3.0 }],
      [new THREE.ConeGeometry(0.8, 2.2, 7), { y: 4.2 }],
    ])
    const pineMat = makeToonMaterial({ color: PALETTE.pine, rim: 0.25, rimColor: 0x9be8c8 })
    // Pines are pushed to the outer ring so they frame the arena instead of
    // cluttering the middle of a fight.
    // Kept to the outer ring: with the camera this close, a pine anywhere near
    // the player fills a third of the screen and hides the fight behind it.
    const pines = this._scatter(34, 6, PLATEAU_RADIUS - 3).filter(([x, z]) => Math.hypot(x, z) > ARENA_RADIUS * 0.92)
    this.pines = new THREE.InstancedMesh(pineGeo, pineMat, pines.length)
    this.pines.castShadow = false
    pines.forEach(([x, z], i) => {
      const s = 0.8 + Math.random() * 0.8
      _dummy.position.set(x, 0, z)
      _dummy.rotation.set(0, Math.random() * Math.PI * 2, 0)
      _dummy.scale.set(s, s * (0.9 + Math.random() * 0.4), s)
      _dummy.updateMatrix()
      this.pines.setMatrixAt(i, _dummy.matrix)
    })
    this.pines.instanceMatrix.needsUpdate = true
    this.group.add(this.pines)

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
