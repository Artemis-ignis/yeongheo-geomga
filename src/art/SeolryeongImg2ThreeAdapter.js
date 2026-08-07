import * as THREE from 'three'
import { createSeolryeongFrostSilkSwordswomanModel } from './generated/SeolryeongImg2ThreeBlockout.ts'
import { buildHeroicSeolryeong } from './HeroicModels.js'

// The img2threejs factory owns the authored geometry, PBR channels, sockets and
// component metadata. This adapter keeps the game's existing chibi contract so
// Player/Game can use the new model without a second simulation path.
const _bounds = new THREE.Box3()
const _size = new THREE.Vector3()
const _center = new THREE.Vector3()
const _textureLoader = typeof document !== 'undefined' ? new THREE.TextureLoader() : null
const _textureCache = new Map()
let _trellisLoaderPromise = null
let _trellisHeroPromise = null
const _silkMaterials = new Set(['base', 'shirt', 'pants'])
// The reference hero is the focal point of the survivor arena.  The old 3.35
// unit shell was technically present but read as a small white marker once the
// horde and shrine filled the frame.  Keep the hitbox unchanged and give only
// the presentation rig a little more vertical authority.
// Give the authored silhouette enough screen area for its material and layered
// costume work to survive the survivor camera. This changes presentation only;
// Player's combat collider and movement scale remain untouched.
const HERO_HEIGHT = 4.55
const HERO_READABILITY_LIFT = 1.18

function assetUrl(file) {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base}assets/${file}`
}

function loadTrellisHeroSource() {
  if (typeof document === 'undefined') return Promise.resolve(null)
  if (!_trellisHeroPromise) {
    _trellisLoaderPromise ??= import('three/examples/jsm/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader())
    _trellisHeroPromise = _trellisLoaderPromise
      .then((loader) => loader.loadAsync(assetUrl('models/characters/seolryeong-trellis-v4.glb')))
      .then((gltf) => gltf.scene)
      .catch((error) => {
        console.warn('[yeongheo] Seolryeong TRELLIS GLB unavailable; keeping authored fallback', error)
        return null
      })
  }
  return _trellisHeroPromise.then((source) => source?.clone(true) ?? null)
}

function prepareTrellisHeroVisual(source) {
  if (!source) return null
  const bounds = new THREE.Box3().setFromObject(source)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  bounds.getSize(size)
  bounds.getCenter(center)
  const normalizedScale = HERO_HEIGHT / Math.max(0.001, size.y)
  source.scale.setScalar(normalizedScale)
  source.position.set(-center.x * normalizedScale, -bounds.min.y * normalizedScale, -center.z * normalizedScale)
  source.name = 'seolryeong-trellis-v4-runtime-mesh'
  source.userData.assetPipeline = 'github-img2threejs-trellis'
  source.userData.referenceAsset = 'assets/characters/seolryeong-turnaround-v4.png'
  source.userData.generatedModelStatus = 'multi-view-generative-proxy-reviewed-runtime'
  source.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = true
    object.receiveShadow = true
    object.frustumCulled = true
    if (object.geometry) object.geometry.userData.sharedByImg2Three = true
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (!material) return
      material.userData.sharedByImg2Three = true
      // The generative GLB arrives with a very low-value navy albedo.  Under
      // the moon court grade that collapses the adult face, collar, and robe
      // layers into one silhouette.  A bounded material lift restores plane
      // separation without adding another post-process pass or changing the
      // combat hitbox.
      if (material.color) material.color.multiplyScalar(HERO_READABILITY_LIFT)
      if ('roughness' in material && Number.isFinite(material.roughness)) {
        material.roughness = Math.max(0.30, material.roughness * 0.92)
      }
      if (material.emissive) {
        material.emissive.set(0x0b1b34)
        material.emissiveIntensity = Math.min(0.16, Math.max(0.06, material.emissiveIntensity ?? 0.06))
      }
      material.envMapIntensity = 1.35
      material.needsUpdate = true
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap']) {
        const texture = material[key]
        if (texture) texture.userData.sharedByImg2Three = true
      }
    })
  })
  return source
}

function addAuthoredEquipment(stage, presentation) {
  const sourceWeapon = presentation.root.getObjectByName('held-frost-sword')
  const orbit = []
  if (sourceWeapon) {
    const weapon = sourceWeapon.clone(true)
    weapon.name = 'trellis-hero-held-frost-sword'
    weapon.scale.copy(presentation.root.scale)
    stage.add(weapon)
  }

  // The multiview mesh carries the adult face/hair silhouette, while the
  // authored hairpin is a small identity landmark from the ImageGen brief.
  // Keep only that child of the fallback head rig; cloning the entire head
  // would reintroduce the old procedural body on top of the promoted GLB.
  const sourceHairpin = presentation.root.getObjectByName('jade-hairpin')
  if (sourceHairpin?.parent) {
    const hairRig = sourceHairpin.parent.clone(true)
    hairRig.name = 'trellis-hero-authored-jade-hairpin-rig'
    hairRig.traverse((object) => { if (object.isMesh) object.visible = false })
    const hairpin = hairRig.getObjectByName('jade-hairpin')
    hairpin?.traverse((object) => { object.visible = true })
    hairRig.scale.copy(presentation.root.scale)
    stage.add(hairRig)
  }

  presentation.root.traverse((object) => {
    // HeroicModels keeps its three orbit blades hidden until a skill grants
    // them. Reuse those authored blade geometries as equipment on top of the
    // higher quality GLB, so the gameplay skill contract does not disappear
    // when the body presentation is promoted.
    if (!object.isMesh || object.visible || orbit.length >= 3) return
    const blade = object.clone(true)
    blade.name = `trellis-hero-orbit-sword-${orbit.length + 1}`
    blade.scale.copy(presentation.root.scale)
    blade.visible = false
    stage.add(blade)
    orbit.push(blade)
  })
  return { orbit }
}

function applyTexture(root, texture, materialIds) {
  root.traverse((object) => {
    if (!object.isMesh) return
    const sculptComponent = object.userData?.sculptComponent
    const componentMaterial = sculptComponent?.material
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!material || !material.isMaterial) continue
      const materialId = componentMaterial ?? material.userData?.sculptMaterial?.id
      if (!materialIds.has(materialId)) continue
      material.map = texture
      material.needsUpdate = true
    }
  })
}

function loadSilkTexture(root) {
  if (!_textureLoader) return
  const key = 'materials/characters/moon-silk-brocade-v2.png'
  let texture = _textureCache.get(key)
  if (texture) {
    applyTexture(root, texture, _silkMaterials)
    return
  }
  texture = _textureLoader.load(assetUrl(key), (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace
    loaded.wrapS = THREE.RepeatWrapping
    loaded.wrapT = THREE.RepeatWrapping
    loaded.repeat.set(2.35, 3.1)
    loaded.anisotropy = 2
    loaded.userData.sharedByYeongheo = true
    _textureCache.set(key, loaded)
    applyTexture(root, loaded, _silkMaterials)
  })
}

export function buildImg2ThreeSeolryeong(character) {
  const root = new THREE.Group()
  root.name = 'heroic-seolryeong-img2three'
  root.userData.assetPipeline = 'img2threejs'
  root.userData.referenceAsset = 'assets/characters/seolryeong-turnaround-v4.png'
  root.userData.presentationReferenceAsset = 'assets/characters/seolryeong-turnaround-v4.png'
  root.userData.generatedStructureReference = 'artifacts/img2threejs/seolryeong/character-model/object-sculpt-spec.json'
  root.userData.presentationBrief = 'artifacts/img2threejs/seolryeong/character-model-v3/assessment.json'
  root.userData.generatedModelStatus = 'official-structure-plus-trellis-v4-runtime-mesh-with-authored-fallback'
  root.userData.qualityTier = 'hero'
  root.userData.renderMode = 'full-3d'

  const model = createSeolryeongFrostSilkSwordswomanModel({
    qualityPriority: 'balanced',
    textureSize: 384,
    textureAnisotropy: 2,
    castShadow: true,
    receiveShadow: true,
  })
  model.name = 'seolryeong-img2three-factory'
  model.userData.renderRole = 'img2threejs-authored-structure'
  _bounds.setFromObject(model)
  _bounds.getSize(_size)
  _bounds.getCenter(_center)
  // The generated factory is authored at human scale. Match the old hero's
  // gameplay silhouette so the high-detail model is readable in the horde,
  // rather than technically present as a thumbnail at the camera's default
  // distance.
  const normalizedScale = HERO_HEIGHT / Math.max(0.001, _size.y)
  model.scale.setScalar(normalizedScale)
  model.position.set(-_center.x * normalizedScale, -_bounds.min.y * normalizedScale, -_center.z * normalizedScale)
  // The upstream factory is the validated structural source for this hero. Its
  // starter geometry is intentionally blockout-like, so keep it in the runtime
  // graph for sockets/metadata while the presentation shell below supplies the
  // readable high-detail silhouette used by the player camera.
  model.visible = false
  root.add(model)
  loadSilkTexture(model)

  const presentation = buildHeroicSeolryeong(character)
  presentation.root.name = 'seolryeong-img2three-presentation-shell'
  const presentationStage = new THREE.Group()
  presentationStage.name = 'seolryeong-presentation-stage'
  presentationStage.add(presentation.root)
  _bounds.setFromObject(presentation.root)
  _bounds.getSize(_size)
  _bounds.getCenter(_center)
  const presentationScale = HERO_HEIGHT / Math.max(0.001, _size.y)
  presentationStage.scale.setScalar(presentationScale)
  presentationStage.position.set(-_center.x * presentationScale, -_bounds.min.y * presentationScale, -_center.z * presentationScale)
  root.add(presentationStage)

  const trellisStage = new THREE.Group()
  trellisStage.name = 'seolryeong-trellis-v4-presentation-stage'
  trellisStage.visible = false
  root.add(trellisStage)
  const trellisEquipmentStage = new THREE.Group()
  trellisEquipmentStage.name = 'seolryeong-trellis-authored-equipment-stage'
  trellisEquipmentStage.visible = false
  trellisEquipmentStage.scale.copy(presentationStage.scale)
  trellisEquipmentStage.position.copy(presentationStage.position)
  root.add(trellisEquipmentStage)
  const trellisEquipment = addAuthoredEquipment(trellisEquipmentStage, presentation)

  let usingTrellis = false
  let swordCount = 0
  loadTrellisHeroSource().then((source) => {
    const visual = prepareTrellisHeroVisual(source)
    if (!visual || !root.parent) return
    trellisStage.add(visual)
    trellisStage.visible = true
    trellisEquipmentStage.visible = true
    presentationStage.visible = false
    usingTrellis = true
    trellisEquipment.orbit.forEach((sword, index) => { sword.visible = index < swordCount })
  })

  let time = 0
  return {
    root,
    height: HERO_HEIGHT,
    setExpression(name, holdSeconds) {
      presentation.setExpression(name, holdSeconds)
    },
    setOrbitSwords(count) {
      swordCount = Math.max(0, Math.min(3, count))
      presentation.setOrbitSwords(swordCount)
      trellisEquipment.orbit.forEach((sword, index) => { sword.visible = usingTrellis && index < swordCount })
    },
    update(dt, speed01, facingAngle) {
      time += dt
      if (!usingTrellis) {
        presentation.update(dt, speed01, facingAngle)
        return
      }
      trellisStage.rotation.y = facingAngle
      trellisEquipmentStage.rotation.y = facingAngle
      const bob = Math.abs(Math.sin(time * 9.0)) * 0.028 * speed01
      trellisStage.position.y = bob
      trellisEquipmentStage.position.y = presentationStage.position.y + bob
      for (let index = 0; index < swordCount; index++) {
        const a = time * 1.25 + index * (Math.PI * 2 / swordCount)
        trellisEquipment.orbit[index].position.set(Math.cos(a) * 0.78, 1.0 + Math.sin(a * 2) * 0.06, Math.sin(a) * 0.78)
        trellisEquipment.orbit[index].rotation.set(Math.PI * 0.92, -a, 0)
      }
    },
    dispose() {
      const geometries = new Set()
      const materials = new Set()
      const textures = new Set()
      root.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry)
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!material) continue
          materials.add(material)
          for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap']) {
            const texture = material[key]
            if (texture && !texture.userData?.sharedByYeongheo && !texture.userData?.sharedByImg2Three && !texture.userData?.sharedByHeroicModels) textures.add(texture)
          }
        }
      })
      geometries.forEach((geometry) => {
        if (!geometry.userData?.sharedByImg2Three) geometry.dispose()
      })
      textures.forEach((texture) => texture.dispose())
      materials.forEach((material) => {
        if (!material.userData?.sharedByImg2Three) material.dispose()
      })
      root.removeFromParent()
    },
  }
}
