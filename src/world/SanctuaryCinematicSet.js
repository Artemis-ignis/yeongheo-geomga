import * as THREE from 'three'
import { makeAdditiveMaterial, makeToonMaterial } from '../art/materials.js'
import { glowTexture, mistTexture, shrineTexture } from '../art/textures.js'
import {
  adoptModel,
  buildEmberPhoenix,
  buildJadeDragon,
  buildJadeTitan,
  buildVoidSage,
} from '../art/HeroicModels.js'

// import.meta.env.BASE_URL keeps the public asset reachable both at `/` during
// local development and at `/yeongheo-geomga/` on GitHub Pages.
const BACKDROP_URL = `${import.meta.env.BASE_URL}assets/jade-sanctuary-environment-v2.png`

const _dummy = new THREE.Object3D()

/**
 * A readable, authored composition that sits around the survivor arena.
 *
 * The game still renders the ground, player, enemies and VFX in Three.js.  The
 * generated plate is only the distant sanctuary layer; the foreground guardians
 * are the same procedural boss/enemy meshes used by combat.  Keeping those two
 * responsibilities separate prevents a pretty background from hiding a weak
 * game scene and makes the set survive an actual run.
 */
export class SanctuaryCinematicSet {
  constructor(scene, palette = {}, stageId = 'jade') {
    this.scene = scene
    this.palette = palette
    this.stageId = stageId
    this.time = 0
    this.group = new THREE.Group()
    this.group.name = 'sanctuary-cinematic-set'
    scene.add(this.group)

    this.geometries = []
    this.materials = []
    this.lights = []
    this.texture = null
    this.plateTexture = null
    this.previousBackground = scene.background
    this._buildBackdrop()
    this._buildArchitecture()
    this._buildGuardians()
    this._buildFocus()
    this._buildMist()
  }

  _geometry(geometry) {
    this.geometries.push(geometry)
    return geometry
  }

  _material(material) {
    this.materials.push(material)
    return material
  }

  _mesh(geometry, material, parent = this.group) {
    const mesh = new THREE.Mesh(geometry, material)
    parent.add(mesh)
    return mesh
  }

  _buildBackdrop() {
    // Keep this plate behind the real arena. It contributes depth and silhouette
    // at the horizon while the player and combat remain ordinary 3D objects.
    const texture = new THREE.TextureLoader().load(
      BACKDROP_URL,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace
        loaded.anisotropy = 4
        loaded.needsUpdate = true

        // The authored environment is the farthest layer in the actual scene.
        // Using the renderer background keeps the real terrain, guardians and
        // combat VFX in front of it without asking a vertical billboard to
        // compete with the ground depth buffer.
        this.scene.background = loaded

        // Bake the lower fade into a normal RGBA texture. This is more portable
        // than a one-channel alpha map across WebGL2 drivers and keeps the
        // backdrop material on the regular MeshBasicMaterial path.
        const image = loaded.image
        if (image?.width && image?.height) {
          const canvas = document.createElement('canvas')
          canvas.width = image.width
          canvas.height = image.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(image, 0, 0)
          ctx.globalCompositeOperation = 'destination-in'
          const fade = ctx.createLinearGradient(0, 0, 0, canvas.height)
          fade.addColorStop(0, 'rgba(255,255,255,1)')
          fade.addColorStop(0.58, 'rgba(255,255,255,1)')
          fade.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = fade
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          const plate = new THREE.CanvasTexture(canvas)
          plate.colorSpace = THREE.SRGBColorSpace
          plate.minFilter = THREE.LinearMipmapLinearFilter
          plate.magFilter = THREE.LinearFilter
          plate.anisotropy = 4
          plate.needsUpdate = true
          this.plateTexture = plate
          if (this.backdrop) {
            this.backdrop.material.map = plate
            this.backdrop.material.needsUpdate = true
          }
        }
      },
      undefined,
      () => {
        // Keep the real 3D court visible even if the optional plate is missing;
        // hiding the mesh here also hid later material upgrades during runtime
        // asset retries and made the scene look like the old placeholder.
        this.backdrop.visible = false
      },
    )
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    this.texture = texture
    // Attach the live Texture object immediately; TextureLoader mutates this
    // instance when the PNG finishes loading, so the renderer never misses the
    // first usable frame while the callback builds the optional fade copy.
    this.scene.background = texture
    // Sky owns an opaque shader dome. It is created before this set, so hide it
    // here as well as in Sky's stage-aware path; this keeps the backdrop reliable
    // across hot reloads and packaged builds where constructor arguments can be
    // restored from an older module instance.
    for (const child of this.scene.children) {
      if (child === this.group) continue
      child.traverse((object) => {
        if (object.isMesh && object.material?.isShaderMaterial && object.geometry?.type === 'SphereGeometry') {
          object.visible = false
        }
      })
    }

    // The camera is intentionally pitched down for survivor readability. A
    // small eye-level billboard therefore misses most of the frustum; this
    // wider lower plate gives the distant cliffs and gate enough vertical room
    // to occupy the actual screen, while the arena occludes its lower edge.
    // Match the plate to the camera's horizon scale instead of treating it as
    // an enormous billboard. At width 120 only the middle third of the artwork
    // was visible, which cropped out the moon and most of the waterfalls.
    const geo = this._geometry(new THREE.PlaneGeometry(76, 42.75, 1, 1))
    const mat = this._material(new THREE.MeshBasicMaterial({
      map: null,
      // The map is already the authored blue sanctuary. Multiplying it by a
      // magenta placeholder turned the whole playable world black and pink.
      color: 0xffffff,
      transparent: false,
      alphaTest: 0.018,
      opacity: 1,
      depthTest: true,
      depthWrite: true,
      fog: false,
      side: THREE.DoubleSide,
    }))
    this.backdrop = this._mesh(geo, mat)
    this.backdrop.name = 'sanctuary-backdrop-plate'
    // The follow camera looks down toward the arena. At this distance the
    // screen's horizon is several metres below the camera, so centring the
    // vertical plate at eye height would put it above the frustum entirely.
    // It sits just beyond the arena's rear rim. A vertical alpha fade at the
    // bottom lets the real stone floor win in the play area while the upper
    // cliffs and gate appear through the pitched camera's horizon.
    // The previous -25 placement pushed the moon, cliff faces and upper gate
    // above the pitched camera's useful band. Lift the plate into the horizon
    // so its authored detail survives the real arena's foreground occlusion.
    this.backdrop.position.set(0, 6, -3)
    // The sky dome is rendered without depth writes. Rendering this after the
    // dome but before nearer opaque geometry lets the plate occupy the horizon
    // while the real arena still wins every overlapping pixel.
    // Draw after the opaque sky dome but let the real terrain win through depth.
    // The dome has depthWrite disabled, so a negative order used to let it paint
    // over this plate a second time. The result looked exactly like the old
    // placeholder scene even though the new environment texture had loaded.
    this.backdrop.renderOrder = 100
    this.backdrop.material.depthTest = false
    // The environment is already the scene background. Keeping a second,
    // opaque full-screen plane here doubles fill-rate and hides the actual
    // Three.js guardians, player and combat geometry. The authored image stays
    // a distant layer; gameplay remains real 3D in front of it.
    this.backdrop.visible = false
  }

  _buildArchitecture() {
    const stone = this._material(makeToonMaterial({
      color: 0x344457,
      rim: 0.52,
      rimColor: 0x9ac5e4,
    }))
    const stoneLight = this._material(makeToonMaterial({
      color: 0x65758a,
      rim: 0.42,
      rimColor: 0xd4e8f4,
    }))
    const gold = this._material(makeToonMaterial({
      color: 0x9a6e35,
      rim: 0.72,
      rimColor: 0xffd991,
    }))
    const cyan = this._material(makeAdditiveMaterial({
      color: 0x62dfff,
      opacity: 0.68,
      map: glowTexture(),
    }))
    const plazaMat = this._material(makeToonMaterial({
      color: 0xffffff,
      map: shrineTexture(0x263c4b, 0x132130, 0x76dfff),
      rim: 0.32,
      rimColor: 0x6d9ab7,
    }))
    const plazaTrim = this._material(makeToonMaterial({
      color: 0x6e7f91,
      rim: 0.48,
      rimColor: 0xc4e3f2,
    }))

    // A stone ritual court under the shrine turns the centre of the grass field
    // into a deliberate gameplay stage. It is shallow enough that feet and enemy
    // hit silhouettes remain on the original y=0 collision plane.
    const plaza = this._mesh(this._geometry(new THREE.CylinderGeometry(30.0, 30.0, 0.06, 128)), plazaMat)
    plaza.position.y = 0.025
    plaza.receiveShadow = true
    plaza.renderOrder = 2
    for (const radius of [4.4, 8.6, 12.8, 17.2, 22.2, 27.8]) {
      const ring = this._mesh(this._geometry(new THREE.TorusGeometry(radius, 0.055, 6, 96)), plazaTrim)
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.075
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const spoke = this._mesh(this._geometry(new THREE.BoxGeometry(0.12, 0.035, 7.2)), plazaTrim)
      spoke.position.set(Math.sin(a) * 10.0, 0.075, Math.cos(a) * 10.0)
      spoke.rotation.y = a
    }

    // A closer gate gives the backdrop a real foreground anchor. It is narrow
    // enough to frame the player instead of becoming a wall across the arena.
    const gate = new THREE.Group()
    gate.name = 'closer-sanctuary-gate'
    gate.position.set(0, 0, -13.5)
    this.group.add(gate)

    for (const side of [-1, 1]) {
      const pillar = new THREE.Group()
      pillar.position.x = side * 6.0
      gate.add(pillar)
      this._mesh(this._geometry(new THREE.CylinderGeometry(0.82, 1.05, 6.6, 10)), stone, pillar).position.y = 3.3
      this._mesh(this._geometry(new THREE.CylinderGeometry(1.25, 1.25, 0.34, 10)), stoneLight, pillar).position.y = 6.65
      const cap = this._mesh(this._geometry(new THREE.ConeGeometry(1.5, 0.75, 6)), gold, pillar)
      cap.position.y = 7.15
      cap.rotation.y = Math.PI / 6

      const lantern = this._mesh(this._geometry(new THREE.BoxGeometry(0.72, 0.9, 0.72)), cyan, pillar)
      lantern.position.set(0, 4.65, 0.58)
      lantern.renderOrder = 4

      const light = new THREE.PointLight(0x58caff, 10, 16, 2)
      light.position.set(0, 4.65, 0.58)
      pillar.add(light)
      this.lights.push({ light, base: 10, phase: side * 0.8, speed: 1.6 })
    }

    const beam = this._mesh(this._geometry(new THREE.BoxGeometry(14.2, 0.72, 0.8)), stoneLight, gate)
    beam.position.y = 7.0
    beam.rotation.z = -0.025
    const beamTrim = this._mesh(this._geometry(new THREE.BoxGeometry(13.2, 0.12, 0.92)), gold, gate)
    beamTrim.position.set(0, 7.35, 0.02)

    // Roof tiers break the straight box silhouette and pick up the moon rim.
    for (const [y, width, depth] of [[7.65, 8.6, 1.4], [8.25, 6.5, 1.15]]) {
      const roof = this._mesh(this._geometry(new THREE.ConeGeometry(width, 0.55, 4)), stone, gate)
      roof.position.set(0, y, -0.05)
      roof.scale.z = depth / width
      roof.rotation.y = Math.PI / 4
    }

    // Tall banners are intentionally outside the play clearing. Their cloth is
    // a 2D surface in a 3D pole assembly, like a normal game prop, not a HUD.
    const bannerMat = this._material(new THREE.MeshToonMaterial({
      color: 0x15243a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    }))
    const bannerGold = this._material(makeAdditiveMaterial({
      color: 0xe7b65b,
      opacity: 0.6,
      map: glowTexture(),
    }))
    for (const side of [-1, 1]) {
      const banner = new THREE.Group()
      banner.position.set(side * 10.0, 0, -9.5)
      banner.rotation.y = side * 0.14
      this.group.add(banner)
      const pole = this._mesh(this._geometry(new THREE.CylinderGeometry(0.08, 0.12, 7.5, 8)), gold, banner)
      pole.position.y = 3.75
      const flagGeo = this._geometry(new THREE.PlaneGeometry(2.15, 4.3, 5, 7))
      const flag = this._mesh(flagGeo, bannerMat.clone(), banner)
      this.materials.push(flag.material)
      flag.position.set(0, 4.75, 0.02)
      flag.scale.x = side
      const emblem = this._mesh(this._geometry(new THREE.PlaneGeometry(0.58, 1.15)), bannerGold, banner)
      emblem.position.set(0, 4.9, 0.045)
      emblem.scale.x = side
      banner.userData.phase = side * 1.1
      banner.userData.flag = flag
    }

    // A few moonlit plinths connect the close gate to the distant environment.
    for (const [x, z, s] of [[-15, -5, 1.2], [15, -5, 1.2], [-17, -15, 0.9], [17, -15, 0.9]]) {
      const plinth = new THREE.Group()
      plinth.position.set(x, 0, z)
      plinth.scale.setScalar(s)
      this.group.add(plinth)
      this._mesh(this._geometry(new THREE.CylinderGeometry(0.68, 0.95, 0.7, 8)), stone, plinth).position.y = 0.35
      const statue = this._mesh(this._geometry(new THREE.ConeGeometry(0.48, 2.9, 6)), stoneLight, plinth)
      statue.position.y = 2.1
      statue.rotation.z = (x < 0 ? -1 : 1) * 0.12
      const crest = this._mesh(this._geometry(new THREE.OctahedronGeometry(0.25, 0)), cyan, plinth)
      crest.position.y = 3.65
      crest.renderOrder = 3
    }
  }

  _buildGuardians() {
    // The showcase uses authored high-segment Three.js models. They are not
    // scaled enemy blobs: each silhouette has its own construction, PBR
    // material family, layered armour/cloth, and light response.
    this.wolf = adoptModel(buildJadeTitan(), this.geometries, this.materials)
    this.wolf.name = 'sanctum-jade-titan'
    this.wolf.position.set(-7.8, 0, -3.9)
    this.wolf.rotation.y = -0.32
    this.wolf.scale.setScalar(1.18)
    this.group.add(this.wolf)

    this.serpent = adoptModel(buildJadeDragon(), this.geometries, this.materials)
    this.serpent.name = 'sanctum-jade-dragon'
    this.serpent.position.set(7.2, 0.08, -3.0)
    this.serpent.rotation.y = -0.72
    this.serpent.scale.setScalar(2.0)
    this.group.add(this.serpent)

    this.raven = adoptModel(buildEmberPhoenix(), this.geometries, this.materials)
    this.raven.name = 'sanctum-ember-phoenix'
    this.raven.position.set(3.8, 1.0, -7.6)
    this.raven.rotation.y = Math.PI + 0.16
    this.raven.scale.setScalar(1.45)
    this.group.add(this.raven)

    this.lord = adoptModel(buildVoidSage(), this.geometries, this.materials)
    this.lord.name = 'sanctum-void-sage'
    this.lord.position.set(0, 0.02, -8.3)
    this.lord.scale.setScalar(0.82)
    this.group.add(this.lord)

    for (const [color, intensity, distance, position, phase, speed] of [
      [0x47d9ff, 18, 15, [-7.0, 2.4, -1.0], 0.2, 1.1],
      [0x46ffe0, 12, 15, [7.0, 2.2, -1.0], 1.4, 1.35],
      [0xff6a35, 20, 18, [3.8, 3.0, -5.8], 2.2, 1.8],
      [0xb16cff, 10, 12, [0, 2.2, -7.0], 3.0, 0.9],
    ]) {
      const light = new THREE.PointLight(color, intensity, distance, 2)
      light.position.set(...position)
      this.group.add(light)
      this.lights.push({ light, base: intensity, phase, speed })
    }

    const ringDefs = [[this.wolf, 2.9, 0x5ee8ff], [this.serpent, 2.4, 0x65ffe0], [this.raven, 2.2, 0xff7548], [this.lord, 1.35, 0xd693ff]]
    this.guardianRings = []
    for (const [parent, radius, color] of ringDefs) {
      const material = this._material(makeAdditiveMaterial({ color, opacity: 0.30, map: glowTexture() }))
      const ring = this._mesh(this._geometry(new THREE.TorusGeometry(radius, 0.035, 8, 72)), material, parent)
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.10
      this.guardianRings.push({ ring, phase: this.guardianRings.length * 1.7 })
    }

    const lordHaloMat = this._material(makeAdditiveMaterial({
      color: 0xd98cff,
      opacity: 0.48,
      map: glowTexture(),
    }))
    this.lordHalo = this._mesh(this._geometry(new THREE.TorusGeometry(0.92, 0.045, 8, 56)), lordHaloMat, this.lord)
    this.lordHalo.position.set(0, 2.52, -0.30)
    this.lordHalo.rotation.x = 0.20

  }

  _buildFocus() {
    this.focus = new THREE.Group()
    this.focus.name = 'player-focus-runes'
    this.group.add(this.focus)

    const ringMat = this._material(makeAdditiveMaterial({
      color: 0x83e8ff,
      opacity: 0.58,
      map: glowTexture(),
    }))
    const innerMat = this._material(makeAdditiveMaterial({
      color: 0xd7fbff,
      opacity: 0.32,
      map: glowTexture(),
    }))
    const ring = this._mesh(this._geometry(new THREE.TorusGeometry(2.65, 0.045, 8, 96)), ringMat, this.focus)
    ring.rotation.x = Math.PI / 2
    const inner = this._mesh(this._geometry(new THREE.TorusGeometry(1.9, 0.025, 8, 96)), innerMat, this.focus)
    inner.rotation.x = Math.PI / 2
    const slashMat = this._material(makeAdditiveMaterial({
      color: 0xe8fbff,
      opacity: 0.72,
      map: glowTexture(),
    }))
    const slash = this._mesh(this._geometry(new THREE.TorusGeometry(3.15, 0.075, 7, 88, Math.PI * 0.82)), slashMat, this.focus)
    slash.rotation.x = Math.PI / 2
    slash.position.y = 0.09
    const slashWarm = this._mesh(this._geometry(new THREE.TorusGeometry(3.55, 0.045, 7, 88, Math.PI * 0.54)), ringMat, this.focus)
    slashWarm.rotation.x = Math.PI / 2
    slashWarm.position.y = 0.11
    this.focusRing = ring
    this.focusInner = inner
    this.focusSlash = slash
    this.focusSlashWarm = slashWarm

    const moteGeo = this._geometry(new THREE.IcosahedronGeometry(0.08, 0))
    this.motes = new THREE.InstancedMesh(moteGeo, innerMat, 22)
    this.group.add(this.motes)
    this.moteData = Array.from({ length: 22 }, (_, i) => ({
      radius: 2.0 + (i % 5) * 0.24,
      angle: (i / 22) * Math.PI * 2,
      height: 0.35 + (i % 4) * 0.26,
      phase: i * 0.73,
    }))
  }

  _buildMist() {
    const mat = this._material(new THREE.MeshBasicMaterial({
      map: mistTexture(),
      color: 0x83b9e4,
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }))
    this.mistCards = []
    for (const [x, y, z, sx, sy, phase] of [[-12, 3.3, -7, 12, 4, 0], [12, 4.0, -12, 14, 4.5, 1.9], [0, 5.6, -18, 22, 5.0, 3.1]]) {
      const card = this._mesh(this._geometry(new THREE.PlaneGeometry(sx, sy)), mat, this.group)
      card.position.set(x, y, z)
      card.userData.phase = phase
      card.renderOrder = -5
      this.mistCards.push(card)
    }
  }

  setQuality(scale) {
    // Large transparent mist cards are a fill-rate tax, not gameplay state.
    // Keep them for the high tier and remove them first when the scaler reacts.
    const mistVisible = scale >= 0.78
    for (const card of this.mistCards ?? []) card.visible = mistVisible
    if (this.motes) this.motes.visible = scale >= 0.70
  }

  update(dt, playerX = 0, playerZ = 0) {
    this.time += dt

    // The horizon has a gentle parallax response instead of being glued to the
    // camera. The set remains anchored to the sanctuary while the player moves.
    if (this.backdrop) {
      this.backdrop.position.x = playerX * 0.12
      this.backdrop.position.z = -10 + playerZ * 0.04
    }
    this.focus.position.set(playerX, 0, playerZ)
    this.motes.position.set(playerX, 0, playerZ)

    this.focusRing.rotation.z = this.time * 0.22
    this.focusInner.rotation.z = -this.time * 0.31
    this.focusSlash.rotation.z = -this.time * 0.56
    this.focusSlashWarm.rotation.z = this.time * 0.34 + 1.1
    this.focusSlash.material.opacity = 0.44 + Math.sin(this.time * 2.2) * 0.16
    for (let i = 0; i < this.moteData.length; i++) {
      const m = this.moteData[i]
      const a = m.angle + this.time * (0.25 + (i % 3) * 0.05)
      _dummy.position.set(Math.cos(a) * m.radius, m.height + Math.sin(this.time * 1.4 + m.phase) * 0.18, Math.sin(a) * m.radius)
      _dummy.rotation.set(this.time * 0.8, a, this.time * 0.5)
      _dummy.scale.setScalar(0.7 + 0.3 * Math.sin(this.time * 2 + m.phase))
      _dummy.updateMatrix()
      this.motes.setMatrixAt(i, _dummy.matrix)
    }
    this.motes.instanceMatrix.needsUpdate = true

    this.wolf.position.y = Math.sin(this.time * 0.8) * 0.035
    this.serpent.position.y = 0.08 + Math.sin(this.time * 0.9 + 1.3) * 0.05
    this.raven.position.y = 0.25 + Math.sin(this.time * 1.2) * 0.34
    this.raven.rotation.z = Math.sin(this.time * 0.7) * 0.05
    this.lord.position.y = 0.02 + Math.sin(this.time * 0.65 + 0.8) * 0.04
    this.lordHalo.rotation.z = this.time * 0.24

    for (const { ring, phase } of this.guardianRings) {
      ring.rotation.z = this.time * 0.32 + phase
      ring.material.opacity = 0.25 + Math.sin(this.time * 1.4 + phase) * 0.10
    }
    for (const item of this.lights) {
      item.light.intensity = item.base * (0.82 + Math.sin(this.time * item.speed + item.phase) * 0.12)
    }
    for (const card of this.mistCards) {
      card.position.x += Math.sin(this.time * 0.08 + card.userData.phase) * 0.001
      card.material.opacity = 0.07 + Math.sin(this.time * 0.35 + card.userData.phase) * 0.02
    }
    for (const child of this.group.children) {
      if (child.userData?.flag) {
        child.userData.flag.rotation.z = Math.sin(this.time * 1.4 + child.userData.phase) * 0.035
      }
    }
  }

  dispose() {
    this.scene.remove(this.group)
    if (this.scene.background === this.texture || this.scene.background === this.plateTexture) {
      this.scene.background = this.previousBackground
    }
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    this.texture?.dispose()
    this.plateTexture?.dispose()
  }
}
