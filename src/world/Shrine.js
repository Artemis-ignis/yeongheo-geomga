import * as THREE from 'three'
import { makeToonMaterial, PALETTE } from '../art/materials.js'
import { buildMerged } from '../art/geometry.js'
import { gradient, roughen } from '../art/shapeKit.js'
import { shrineTexture } from '../art/textures.js'

const _dummy = new THREE.Object3D()

function shade(hex, factor) {
  const color = new THREE.Color(hex)
  color.multiplyScalar(factor)
  return color.getHex()
}

/**
 * Low-profile landmark geometry that gives the playable space an authored
 * centre without adding collision or hiding the horde. The shrine is shared by
 * every stage; the stage palette supplies its stone and spirit-light colours.
 */
export class Shrine {
  constructor(parent, palette = {}) {
    this.time = 0
    this.group = new THREE.Group()
    this.group.name = 'jade-mountain-shrine'
    parent.add(this.group)

    const stone = palette.shrineStone
      ?? shade(palette.ground ?? palette.stone ?? PALETTE.jadeDark, 1.42)
    const accent = palette.shrineAccent ?? palette.barrier ?? PALETTE.jade
    const deepStone = shade(stone, 0.72)

    const plazaGeo = new THREE.CylinderGeometry(4.55, 4.82, 0.22, 64)
    gradient(plazaGeo, deepStone, stone, 'y')
    this.plaza = new THREE.Mesh(plazaGeo, makeToonMaterial({
      color: 0xffffff,
      map: shrineTexture(stone, deepStone, accent),
      vertexColors: true,
      rim: 0.2,
      rimColor: accent,
      emissive: stone,
      emissiveIntensity: 0.28,
    }))
    this.plaza.position.y = 0.10
    this.plaza.receiveShadow = true
    this.group.add(this.plaza)

    const lipGeo = new THREE.TorusGeometry(4.28, 0.12, 8, 96)
    this.lip = new THREE.Mesh(lipGeo, makeToonMaterial({
      color: stone, rim: 0.34, rimColor: accent,
    }))
    this.lip.rotation.x = Math.PI / 2
    this.lip.position.y = 0.24
    this.group.add(this.lip)

    const ringMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.ringMat = ringMat
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(3.24, 0.065, 8, 96), ringMat)
    this.ring.rotation.x = Math.PI / 2
    this.ring.position.y = 0.27
    this.group.add(this.ring)

    this.innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.038, 6, 64), ringMat.clone())
    this.innerRing.rotation.x = Math.PI / 2
    this.innerRing.position.y = 0.28
    this.group.add(this.innerRing)

    const pathGeo = new THREE.BoxGeometry(0.28, 0.06, 5.0, 1, 1, 4)
    const pathMat = makeToonMaterial({ color: shade(stone, 0.84), rim: 0.16, rimColor: accent })
    this.paths = new THREE.InstancedMesh(pathGeo, pathMat, 8)
    this.paths.castShadow = true
    this.paths.receiveShadow = true
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      _dummy.position.set(Math.sin(angle) * 6.4, 0.12, Math.cos(angle) * 6.4)
      _dummy.rotation.set(0, angle, 0)
      _dummy.scale.set(1, 1, 1 + (i % 2) * 0.06)
      _dummy.updateMatrix()
      this.paths.setMatrixAt(i, _dummy.matrix)
    }
    this.paths.instanceMatrix.needsUpdate = true
    this.group.add(this.paths)

    const runeGeo = new THREE.BoxGeometry(0.16, 0.045, 1.05, 1, 1, 2)
    this.runeMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.runes = new THREE.InstancedMesh(runeGeo, this.runeMat, 8)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8
      _dummy.position.set(Math.sin(angle) * 2.24, 0.30, Math.cos(angle) * 2.24)
      _dummy.rotation.set(0, angle, 0)
      _dummy.updateMatrix()
      this.runes.setMatrixAt(i, _dummy.matrix)
    }
    this.runes.instanceMatrix.needsUpdate = true
    this.group.add(this.runes)

    const pillarGeo = buildMerged([
      [roughen(new THREE.CylinderGeometry(0.26, 0.38, 2.15, 8), 0.08, 17), { y: 1.08 }],
      [new THREE.BoxGeometry(0.62, 0.14, 0.62), { y: 2.17 }],
      [new THREE.ConeGeometry(0.44, 0.28, 4), { y: 2.38 }],
    ])
    gradient(pillarGeo, deepStone, stone, 'y')
    this.pillars = new THREE.InstancedMesh(pillarGeo, makeToonMaterial({
      color: 0xffffff, vertexColors: true, rim: 0.34, rimColor: accent,
    }), 4)
    this.pillars.castShadow = true
    this.pillars.receiveShadow = true
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
      _dummy.position.set(Math.sin(angle) * 6.0, 0, Math.cos(angle) * 6.0)
      _dummy.rotation.set(0, angle, 0)
      _dummy.scale.setScalar(0.72 + (i % 2) * 0.08)
      _dummy.updateMatrix()
      this.pillars.setMatrixAt(i, _dummy.matrix)
    }
    this.pillars.instanceMatrix.needsUpdate = true
    this.group.add(this.pillars)
  }

  update(dt) {
    this.time += dt
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.2)
    this.ringMat.opacity = 0.18 + pulse * 0.12
    this.runeMat.opacity = 0.28 + pulse * 0.18
    this.ring.rotation.z = this.time * 0.08
    this.innerRing.rotation.z = -this.time * 0.12
  }
}
