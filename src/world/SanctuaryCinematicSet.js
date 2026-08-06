import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { makeAdditiveMaterial, makeToonMaterial } from '../art/materials.js'
import { glowTexture, mistTexture, shrineTexture } from '../art/textures.js'
import {
  adoptModel,
  buildEmberPhoenix,
  buildJadeDragon,
  buildVoidSage,
} from '../art/HeroicModels.js'
import { buildJadeSanctuaryGate } from '../art/JadeSanctuaryGate.js'
import { buildBossGeometry } from '../art/bossGeometry.js'

// import.meta.env.BASE_URL keeps the public asset reachable both at `/` during
// local development and at `/yeongheo-geomga/` on GitHub Pages.
const BACKDROP_URL = `${import.meta.env.BASE_URL}assets/environment/jade-sanctuary-environment-v2.png`
const PAVER_TEXTURE_URL = `${import.meta.env.BASE_URL}assets/materials/environment/jade-pavilion-stone-v1.png`

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
    this.domBackdrop = typeof document !== 'undefined'
      ? document.getElementById('cinematic-backdrop') : null
    this.domBackdrop?.classList.toggle('active', stageId === 'jade')
    this.time = 0
    this.group = new THREE.Group()
    this.group.name = 'sanctuary-cinematic-set'
    scene.add(this.group)
    this.architecture = new THREE.Group()
    this.architecture.name = 'sanctuary-live-architecture'
    this.horizonArchitecture = new THREE.Group()
    this.horizonArchitecture.name = 'sanctuary-live-horizon-architecture'
    this.architecture.add(this.horizonArchitecture)
    this.group.add(this.architecture)

    this.geometries = []
    this.materials = []
    this.textures = []
    this.lights = []
    this.texture = null
    this.previousBackground = scene.background
    this._buildBackdrop()
    this._buildArchitecture()
    this._buildGuardians()
    this._buildFocus()
    this._buildMist()
    this.shadowMeshes = []
    this.group.traverse((object) => {
      if (object.isMesh && object.castShadow) this.shadowMeshes.push(object)
    })
  }

  _geometry(geometry) {
    this.geometries.push(geometry)
    return geometry
  }

  _material(material) {
    this.materials.push(material)
    return material
  }

  _mesh(geometry, material, parent = this.architecture ?? this.group) {
    const mesh = new THREE.Mesh(geometry, material)
    parent.add(mesh)
    return mesh
  }

  _buildBackdrop() {
    // The PNG is a distant environment only. It belongs in scene.background;
    // the playable court and all foreground guardians remain real Three.js
    // geometry in front of it.
    const texture = new THREE.TextureLoader().load(
      BACKDROP_URL,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace
        loaded.anisotropy = Math.min(4, this.scene.userData.maxAnisotropy ?? 4)
        loaded.needsUpdate = true
        // ACES compresses the pale moon and distant waterfall heavily. A small
        // background-only lift keeps the generated environment readable while
        // leaving the playable 3D materials and light exposure untouched.
        this.scene.backgroundIntensity = 1.18
        this.scene.background = loaded
      },
      undefined,
      () => {
        // The real 3D court remains playable if the optional environment fails.
        this.scene.background = new THREE.Color(0x0a1320)
      },
    )
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    this.texture = texture
    this.scene.backgroundIntensity = 1

    // Do not hand an image-less TextureLoader result to the renderer. Three.js
    // otherwise checks it every frame while the PNG is pending and emits a
    // warning on some WebGL drivers. A flat colour keeps the first frames valid;
    // the loaded image replaces it in the callback above.
    this.scene.background = new THREE.Color(0x0a1320)
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
      color: 0xe4edf2,
      map: shrineTexture(0x1b2938, 0x0d1724, 0x4c9ab3),
      rim: 0.24,
      rimColor: 0x6c92a8,
    }))
    const plazaTrim = this._material(makeToonMaterial({
      color: 0x3d5366,
      rim: 0.28,
      rimColor: 0x8db4c4,
    }))

    // A stone ritual court under the shrine turns the centre of the grass field
    // into a deliberate gameplay stage. It is shallow enough that feet and enemy
    // hit silhouettes remain on the original y=0 collision plane.
    const plaza = this._mesh(this._geometry(new THREE.CylinderGeometry(30.0, 30.0, 0.06, 128)), plazaMat)
    plaza.position.y = 0.025
    plaza.receiveShadow = true
    plaza.renderOrder = 2

    // The rings establish the ritual layout, but rings alone make the whole
    // floor read like a debug diagram.  A single instanced field of damp,
    // bevelled stone pavers supplies the surface scale and broken highlight
    // rhythm seen in the reference without adding one draw call per tile.
    const paverGeometry = this._geometry(new RoundedBoxGeometry(1.72, 0.12, 0.92, 1, 0.045))
    // The bevel is valuable at native resolution, but the same rounded box
    // repeated nearly a thousand times becomes a surprisingly large triangle
    // budget after the adaptive scaler has already dropped the backbuffer.
    // Keep a crisp box LOD with the same transforms, colours and material so
    // the court still reads as wet masonry at the emergency gameplay tier.
    const paverLowGeometry = this._geometry(new THREE.BoxGeometry(1.72, 0.10, 0.92))
    // ImageGen's tileable moonstone is used on the actual instanced 3D pavers,
    // not as a backdrop plate. Keep the texture shared so the court gains stone
    // micro-detail without allocating a material or texture per instance.
    const paverTexture = new THREE.TextureLoader().load(PAVER_TEXTURE_URL)
    paverTexture.colorSpace = THREE.SRGBColorSpace
    paverTexture.wrapS = THREE.RepeatWrapping
    paverTexture.wrapT = THREE.RepeatWrapping
    paverTexture.repeat.set(0.42, 0.42)
    paverTexture.anisotropy = Math.min(4, this.scene.userData.maxAnisotropy ?? 4)
    paverTexture.userData.sharedByYeongheo = true
    this.textures.push(paverTexture)
    const paverMaterial = this._material(new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: paverTexture,
      roughness: 0.44,
      metalness: 0.10,
      clearcoat: 0.34,
      clearcoatRoughness: 0.22,
      vertexColors: true,
    }))
    const paverPositions = []
    for (let gz = -14; gz <= 14; gz++) {
      for (let gx = -16; gx <= 16; gx++) {
        const jitterX = Math.sin(gx * 4.3 + gz * 6.1) * 0.10
        const jitterZ = Math.cos(gx * 5.7 - gz * 3.2) * 0.055
        const x = gx * 1.72 + (Math.abs(gz) % 2 ? 0.84 : 0) + jitterX
        const z = gz * 0.92 + jitterZ
        if (Math.hypot(x, z) > 29.0) continue
        paverPositions.push([x, z, gx, gz])
      }
    }
    this.plazaPavers = new THREE.InstancedMesh(paverGeometry, paverMaterial, paverPositions.length)
    this.plazaPavers.name = 'sanctuary-wet-stone-pavers'
    this.plazaPavers.castShadow = false
    this.plazaPavers.receiveShadow = true
    this.plazaPaversLow = new THREE.InstancedMesh(paverLowGeometry, paverMaterial, paverPositions.length)
    this.plazaPaversLow.name = 'sanctuary-wet-stone-pavers-low-lod'
    this.plazaPaversLow.castShadow = false
    this.plazaPaversLow.receiveShadow = true
    this.plazaPaversLow.visible = false
    const paverColor = new THREE.Color()
    for (let i = 0; i < paverPositions.length; i++) {
      const [x, z, gx, gz] = paverPositions[i]
      const wobble = Math.sin(gx * 12.7 + gz * 4.1) * 0.025
      _dummy.position.set(x, 0.055 + wobble, z)
      _dummy.rotation.set(0, Math.sin(gx * 2.3 + gz * 1.7) * 0.07, 0)
      _dummy.scale.set(0.94 + Math.sin(gx * 3.1 + gz) * 0.035, 1, 0.90 + Math.cos(gz * 2.4 - gx) * 0.04)
      _dummy.updateMatrix()
      this.plazaPavers.setMatrixAt(i, _dummy.matrix)
      this.plazaPaversLow.setMatrixAt(i, _dummy.matrix)
      const shade = 0.88 + (Math.sin(gx * 6.2 + gz * 3.7) * 0.5 + 0.5) * 0.18
      paverColor.setRGB(0.62 * shade, 0.72 * shade, 0.82 * shade)
      this.plazaPavers.setColorAt(i, paverColor)
      this.plazaPaversLow.setColorAt(i, paverColor)
    }
    this.plazaPavers.instanceMatrix.needsUpdate = true
    if (this.plazaPavers.instanceColor) this.plazaPavers.instanceColor.needsUpdate = true
    this.plazaPaversLow.instanceMatrix.needsUpdate = true
    if (this.plazaPaversLow.instanceColor) this.plazaPaversLow.instanceColor.needsUpdate = true
    this.architecture.add(this.plazaPavers)
    this.architecture.add(this.plazaPaversLow)
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
    this.horizonArchitecture.add(gate)

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
      this.horizonArchitecture.add(banner)
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
      this.horizonArchitecture.add(plinth)
      this._mesh(this._geometry(new THREE.CylinderGeometry(0.68, 0.95, 0.7, 8)), stone, plinth).position.y = 0.35
      const statue = this._mesh(this._geometry(new THREE.ConeGeometry(0.48, 2.9, 6)), stoneLight, plinth)
      statue.position.y = 2.1
      statue.rotation.z = (x < 0 ? -1 : 1) * 0.12
      const crest = this._mesh(this._geometry(new THREE.OctahedronGeometry(0.25, 0)), cyan, plinth)
      crest.position.y = 3.65
      crest.renderOrder = 3
    }

    // The imagegen gate reference is now represented by a real foreground
    // modular asset. The old horizon props stay available for the other realms,
    // but jade uses this img2threejs-authored structure so the image never has
    // to pretend to be the playable 3D architecture.
    this.gate = adoptModel(buildJadeSanctuaryGate(), this.geometries, this.materials)
    this.gate.name = 'jade-sanctuary-gate-img2threejs'
    this.gate.position.set(0, 0, -6.4)
    this.gate.scale.setScalar(0.58)
    this.group.add(this.gate)
    this.textures.push(...(this.gate.userData.ownedTextures ?? []))
    for (const item of this.gate.userData.lights ?? []) {
      this.lights.push({ light: item.light, base: item.base, phase: item.phase, speed: 2.2 })
    }
  }

  _buildGuardians() {
    // The showcase uses authored high-segment Three.js models. They are not
    // scaled enemy blobs: each silhouette has its own construction, PBR
    // material family, layered armour/cloth, and light response.
    const titanShowcase = new THREE.Group()
    titanShowcase.name = 'heroic-jade-titan'
    titanShowcase.add(new THREE.Mesh(
      buildBossGeometry('jadeVoidWarden'),
      makeToonMaterial({
        color: 0xffffff,
        vertexColors: true,
        rim: 0.38,
        rimColor: 0x9dffe3,
        pbr: true,
        roughness: 0.46,
        metalness: 0.24,
      }),
    ))
    this.wolf = adoptModel(titanShowcase, this.geometries, this.materials)
    this.wolf.name = 'sanctum-jade-titan'
    this.wolf.position.set(-7.8, 0, -3.9)
    this.wolf.rotation.y = -0.32
    this.wolf.scale.setScalar(0.58)
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
      // Emissive materials carry the landmarks; these local lights only shape
      // the nearby planes. Keeping them restrained avoids five full-screen
      // point-light evaluations on every PBR surface.
      [0x47d9ff, 5.5, 13, [-7.0, 2.4, -1.0], 0.2, 1.1],
      [0x46ffe0, 4.0, 13, [7.0, 2.2, -1.0], 1.4, 1.35],
      [0xff6a35, 6.0, 15, [3.8, 3.0, -5.8], 2.2, 1.8],
      [0xb16cff, 3.5, 11, [0, 2.2, -7.0], 3.0, 0.9],
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
    const detailedPavers = scale >= 0.78
    if (this.plazaPavers) this.plazaPavers.visible = detailedPavers
    if (this.plazaPaversLow) this.plazaPaversLow.visible = !detailedPavers
    if (this.motes) this.motes.visible = scale >= 0.70
    if (this.domBackdrop) this.domBackdrop.style.opacity = scale >= 0.78 ? '0.30' : '0.16'
    // On jade, the generated reference is the distant gate/mountain layer. The
    // live court, guardians, focus runes, and all combat geometry remain 3D;
    // only the duplicate low-poly horizon props are removed.
    if (this.horizonArchitecture) this.horizonArchitecture.visible = this.stageId !== 'jade'
    this.gate?.userData.setQuality?.(scale)

    // The four showcase guardians are made from layered physical meshes. They
    // are valuable at native resolution, but become dark, noisy silhouettes at
    // the emergency tier while still costing dozens of draw calls and a shadow
    // pass. Keep the playable hero and horde intact; drop only this decorative
    // showcase layer when the scaler is protecting frame time.
    // The showcase guardians are also the stage's silhouette anchors. Hiding
    // all four at the minimum tier saved geometry work but left a blank,
    // generic arena. They stay visible; only mist and motes are sacrificed on
    // the emergency tier because those do not define the composition.
    const guardianVisible = true
    for (const guardian of [this.wolf, this.serpent, this.raven, this.lord]) {
      if (guardian) guardian.visible = guardianVisible
    }
    for (const item of this.guardianRings ?? []) item.ring.visible = guardianVisible
    if (this.lordHalo) this.lordHalo.visible = guardianVisible
    for (const item of this.lights ?? []) item.light.visible = guardianVisible

    // The hero environment has a real sun shadow pass at native resolution.
    // At the emergency adaptive tier the contact-shadow instancer still grounds
    // the player and horde, while dropping decorative sanctuary casters saves
    // hundreds of shadow-map submissions without changing the silhouettes.
    const environmentShadows = scale >= 0.78
    for (const mesh of this.shadowMeshes ?? []) mesh.castShadow = environmentShadows
  }

  update(dt, playerX = 0, playerZ = 0) {
    this.time += dt

    // The horizon has a gentle parallax response instead of being glued to the
    // camera. The set remains anchored to the sanctuary while the player moves.
    this.focus.position.set(playerX, 0, playerZ)
    this.motes.position.set(playerX, 0, playerZ)

    this.focusRing.rotation.z = this.time * 0.22
    this.focusInner.rotation.z = -this.time * 0.31
    this.focusSlash.rotation.z = -this.time * 0.56
    this.focusSlashWarm.rotation.z = this.time * 0.34 + 1.1
    this.gate?.userData.update?.(dt)
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
    this.domBackdrop?.classList.remove('active')
    if (this.scene.background === this.texture) {
      this.scene.background = this.previousBackground
    }
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    for (const texture of this.textures) texture.dispose()
    this.texture?.dispose()
  }
}
