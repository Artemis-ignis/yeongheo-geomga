import * as THREE from 'three'
import { makeAdditiveMaterial, makeToonMaterial, PALETTE } from '../art/materials.js'
import { buildColored, gradient, roughen } from '../art/shapeKit.js'
import { buildMerged } from '../art/geometry.js'

const _dummy = new THREE.Object3D()

function shade(hex, factor) {
  const c = new THREE.Color(hex)
  c.multiplyScalar(factor)
  return c.getHex()
}

/**
 * Authored background architecture for a run.
 *
 * A survival arena still needs a place to be. This is deliberately a small,
 * merged-draw landmark kit rather than a collision-heavy level: a broken gate,
 * rising steps, hanging banners, bamboo silhouettes and a luminous cliff-water
 * feature give the camera a readable horizon without hiding the horde.
 */
export class SanctuaryLandmarks {
  constructor(parent, palette = {}) {
    this.time = 0
    this.pal = {
      ground: PALETTE.jadeDark,
      stone: PALETTE.stone,
      barrier: PALETTE.jade,
      skyHaze: PALETTE.skyHaze,
      ...palette,
    }
    this.group = new THREE.Group()
    this.group.name = 'sanctuary-landmarks'
    parent.add(this.group)

    this.stone = this.pal.landmarkStone ?? shade(this.pal.stone, 1.18)
    this.deepStone = shade(this.stone, 0.52)
    this.accent = this.pal.landmarkAccent ?? this.pal.barrier
    this.warm = this.pal.groundVein !== undefined
      ? this.pal.groundVein
      : (this.pal.moteRise ? 0xff9c58 : PALETTE.gold)

    this._buildProcessionalSteps()
    this._buildGate()
    this._buildBanners()
    this._buildBamboo()
    this._buildWaterfallCliffs()
  }

  _buildProcessionalSteps() {
    const stepGeo = new THREE.BoxGeometry(5.8, 0.12, 0.84)
    const stepMat = makeToonMaterial({
      color: this.deepStone,
      rim: 0.25,
      rimColor: this.accent,
    })
    this.steps = new THREE.InstancedMesh(stepGeo, stepMat, 7)
    this.steps.castShadow = true
    this.steps.receiveShadow = true
    for (let i = 0; i < 7; i++) {
      _dummy.position.set(0, 0.12 + i * 0.12, -5.2 - i * 0.88)
      _dummy.rotation.set(0, (i % 2 ? 0.006 : -0.006), 0)
      _dummy.scale.set(1 - i * 0.04, 1, 1)
      _dummy.updateMatrix()
      this.steps.setMatrixAt(i, _dummy.matrix)
    }
    this.steps.instanceMatrix.needsUpdate = true
    this.group.add(this.steps)

    const inlayGeo = new THREE.BoxGeometry(0.11, 0.025, 3.8)
    this.inlayMat = new THREE.MeshBasicMaterial({
      color: this.accent,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.inlays = new THREE.InstancedMesh(inlayGeo, this.inlayMat, 5)
    for (let i = 0; i < 5; i++) {
      _dummy.position.set((i - 2) * 0.9, 0.91, -8.1)
      _dummy.rotation.y = i % 2 ? 0.04 : -0.04
      _dummy.updateMatrix()
      this.inlays.setMatrixAt(i, _dummy.matrix)
    }
    this.inlays.instanceMatrix.needsUpdate = true
    this.group.add(this.inlays)
  }

  _gateGeometry() {
    const parts = []
    const pillar = (x, y, z, scale = 1) => {
      parts.push([
        roughen(new THREE.CylinderGeometry(0.62, 0.82, 6.8, 10), 0.07, 11 + Math.round(x * 3)),
        { x, y: y + 3.4 * scale, z, sx: scale, sy: scale, sz: scale },
        undefined,
      ])
      parts.push([
        new THREE.BoxGeometry(1.35, 0.34, 1.35),
        { x, y: y + 6.75 * scale, z },
        this.stone,
      ])
      parts.push([
        new THREE.ConeGeometry(1.05, 0.55, 4),
        { x, y: y + 7.18 * scale, z, rz: Math.PI / 4 },
        this.deepStone,
      ])
    }

    pillar(-4.6, 0, -12.2, 1)
    pillar(4.6, 0, -12.2, 1)
    parts.push([
      new THREE.BoxGeometry(10.8, 0.76, 1.0),
      { y: 7.1, z: -12.2 },
      undefined,
    ])
    parts.push([
      new THREE.BoxGeometry(9.3, 0.32, 1.55),
      { y: 7.65, z: -12.2, rz: 0.018 },
      this.stone,
    ])
    parts.push([
      new THREE.ConeGeometry(5.8, 1.28, 4),
      { y: 8.35, z: -12.2, rz: Math.PI / 4 },
      this.deepStone,
    ])
    // A smaller second roof breaks the single-triangle silhouette.
    parts.push([
      new THREE.ConeGeometry(4.8, 0.74, 4),
      { y: 9.05, z: -12.2, rz: Math.PI / 4 },
      this.stone,
    ])

    const crest = buildColored([
      [new THREE.TorusGeometry(1.15, 0.08, 8, 32), { y: 8.36, z: -12.82, rx: Math.PI / 2 }, this.accent],
      [new THREE.BoxGeometry(0.14, 1.75, 0.08), { y: 8.36, z: -12.84 }, this.warm],
      [new THREE.BoxGeometry(1.35, 0.09, 0.08), { y: 8.36, z: -12.84 }, this.warm],
    ])
    parts.push([crest, {}, undefined])
    return buildColored(parts)
  }

  _buildGate() {
    this.gateMat = makeToonMaterial({
      color: 0xffffff,
      vertexColors: true,
      rim: 0.34,
      rimColor: this.accent,
    })
    this.gate = new THREE.Mesh(this._gateGeometry(), this.gateMat)
    this.gate.castShadow = true
    this.gate.receiveShadow = true
    this.group.add(this.gate)

    // Lanterns are emissive accents, not point-light spam. Their glow remains
    // visible through fog and gives the gate a scale reference at a distance.
    const lanternGeo = buildMerged([
      [new THREE.CylinderGeometry(0.16, 0.22, 0.45, 8), { y: 0.22 }, this.deepStone],
      [new THREE.ConeGeometry(0.26, 0.18, 4), { y: 0.53, rz: Math.PI / 4 }, this.stone],
    ])
    const lanternMat = makeToonMaterial({ color: this.warm, emissive: this.warm, emissiveIntensity: 0.6, rim: 0.2, rimColor: this.warm })
    this.lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, 4)
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1
      _dummy.position.set(side * (i < 2 ? 4.6 : 5.7), 0.2 + (i < 2 ? 3.0 : 2.2), -11.82)
      _dummy.scale.setScalar(i < 2 ? 1.2 : 0.75)
      _dummy.updateMatrix()
      this.lanterns.setMatrixAt(i, _dummy.matrix)
    }
    this.lanterns.instanceMatrix.needsUpdate = true
    this.group.add(this.lanterns)

    this.gateGlowMat = new THREE.MeshBasicMaterial({
      color: this.warm,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.gateGlow = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 6, 32), this.gateGlowMat)
    this.gateGlow.position.set(0, 8.36, -12.78)
    this.gateGlow.rotation.x = Math.PI / 2
    this.group.add(this.gateGlow)
  }

  _buildBanners() {
    const clothGeo = new THREE.PlaneGeometry(1.15, 3.0, 2, 5)
    const clothPos = clothGeo.attributes.position
    for (let i = 0; i < clothPos.count; i++) {
      const x = clothPos.getX(i)
      const y = clothPos.getY(i)
      clothPos.setZ(i, Math.sin((y + 1.5) * 2.1 + x * 2.0) * 0.10 * (1 - Math.abs(y) * 0.18))
    }
    clothPos.needsUpdate = true
    clothGeo.computeVertexNormals()
    this.bannerMat = new THREE.MeshToonMaterial({
      color: shade(this.pal.skyTop ?? 0x161c3f, 1.4),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    })
    this.banners = []
    for (const side of [-1, 1]) {
      const banner = new THREE.Mesh(clothGeo, this.bannerMat.clone())
      banner.position.set(side * 6.15, 5.15, -11.72)
      banner.rotation.y = side * 0.12
      banner.scale.x = side
      banner.castShadow = true
      this.group.add(banner)
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.08, 0.08),
        makeToonMaterial({ color: this.warm, rim: 0.4, rimColor: this.accent }),
      )
      trim.position.set(side * 6.15, 6.68, -11.72)
      this.group.add(trim)
      this.banners.push({ mesh: banner, phase: side * 0.8 })
    }
  }

  _bambooGeometry() {
    const parts = []
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const r = 0.35 + (i % 2) * 0.18
      const h = 3.0 + (i % 3) * 0.55
      parts.push([
        new THREE.CylinderGeometry(0.06, 0.095, h, 7),
        { x: Math.cos(a) * r, y: h * 0.5, z: Math.sin(a) * r, rz: Math.cos(a) * 0.12, rx: Math.sin(a) * 0.10 },
        this.pal.grassBase ?? 0x2f6b4f,
      ])
      for (let j = 0; j < 4; j++) {
        parts.push([
          new THREE.TorusGeometry(0.068, 0.014, 5, 10),
          { x: Math.cos(a) * r, y: 0.45 + j * 0.62, z: Math.sin(a) * r, rx: Math.PI / 2 },
          shade(this.pal.grassBase ?? 0x2f6b4f, 0.7),
        ])
      }
      for (const [dy, side] of [[h * 0.62, -1], [h * 0.78, 1], [h * 0.92, -1]]) {
        const leaf = new THREE.ConeGeometry(0.11, 0.72, 4)
        parts.push([
          leaf,
          { x: Math.cos(a) * r + side * 0.22, y: dy, z: Math.sin(a) * r, rz: side * 0.85, ry: a },
          this.pal.grassTip ?? 0x9fd88a,
        ])
      }
    }
    return buildColored(parts)
  }

  _buildBamboo() {
    const geo = this._bambooGeometry()
    const mat = makeToonMaterial({ color: 0xffffff, vertexColors: true, rim: 0.28, rimColor: this.accent })
    this.bamboo = new THREE.InstancedMesh(geo, mat, 8)
    this.bamboo.castShadow = true
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1
      const row = Math.floor(i / 2)
      _dummy.position.set(side * (8.2 + row * 1.25), 0, -8.8 - row * 1.2)
      _dummy.rotation.y = (i * 1.7) % 6.28
      _dummy.scale.setScalar(0.75 + (i % 3) * 0.12)
      _dummy.updateMatrix()
      this.bamboo.setMatrixAt(i, _dummy.matrix)
    }
    this.bamboo.instanceMatrix.needsUpdate = true
    this.group.add(this.bamboo)
  }

  _buildWaterfallCliffs() {
    const cliffGeo = buildColored([
      [roughen(new THREE.DodecahedronGeometry(3.5, 0), 0.35, 91), { sy: 0.85 }, this.deepStone],
      [roughen(new THREE.ConeGeometry(2.5, 5.5, 7), 0.25, 93), { y: -3.0, sy: 1.4 }, shade(this.deepStone, 0.72)],
    ])
    const cliffMat = makeToonMaterial({ color: 0xffffff, vertexColors: true, rim: 0.32, rimColor: this.pal.skyHaze })
    this.cliffs = new THREE.InstancedMesh(cliffGeo, cliffMat, 3)
    this.cliffs.castShadow = true
    for (let i = 0; i < 3; i++) {
      _dummy.position.set((i - 1) * 15, 7 + (i % 2) * 2.0, -19 - (i % 2) * 3.0)
      _dummy.rotation.y = i * 1.9
      _dummy.scale.setScalar(0.8 + i * 0.15)
      _dummy.updateMatrix()
      this.cliffs.setMatrixAt(i, _dummy.matrix)
    }
    this.cliffs.instanceMatrix.needsUpdate = true
    this.group.add(this.cliffs)

    const waterMat = makeAdditiveMaterial({ color: this.pal.waterfall ?? 0x83e8ff, opacity: 0.20 })
    this.waterMat = waterMat
    const waterGeo = new THREE.PlaneGeometry(1.3, 5.4, 2, 12)
    const waterPos = waterGeo.attributes.position
    for (let i = 0; i < waterPos.count; i++) {
      const x = waterPos.getX(i)
      const y = waterPos.getY(i)
      waterPos.setZ(i, Math.sin((y + 2.7) * 2.5 + x * 4.0) * 0.12)
    }
    waterPos.needsUpdate = true
    this.waterfalls = []
    for (let i = 0; i < 3; i++) {
      const water = new THREE.Mesh(waterGeo, waterMat.clone())
      water.position.set((i - 1) * 15 + (i === 1 ? 0.65 : 0), 6.4 + (i % 2) * 2.0, -16.5 - (i % 2) * 3.0)
      water.rotation.y = i % 2 ? -0.08 : 0.08
      this.group.add(water)
      this.waterfalls.push({ mesh: water, phase: i * 1.8 })
    }
  }

  update(dt) {
    this.time += dt
    const pulse = 0.5 + Math.sin(this.time * 2.0) * 0.5
    this.inlayMat.opacity = 0.32 + pulse * 0.22
    this.gateGlowMat.opacity = 0.13 + pulse * 0.10
    for (const banner of this.banners) {
      banner.mesh.rotation.z = Math.sin(this.time * 1.5 + banner.phase) * 0.035
    }
    for (const waterfall of this.waterfalls) {
      waterfall.mesh.material.opacity = 0.14 + (0.5 + Math.sin(this.time * 2.2 + waterfall.phase) * 0.5) * 0.12
      waterfall.mesh.position.x += Math.sin(this.time * 0.8 + waterfall.phase) * 0.0008
    }
  }
}
