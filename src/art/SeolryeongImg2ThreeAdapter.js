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
const _silkMaterials = new Set(['base', 'shirt', 'pants'])
const HERO_HEIGHT = 3.35

function assetUrl(file) {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base}assets/${file}`
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
  const key = 'materials/characters/moon-silk-weave-v1.png'
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
  root.userData.referenceAsset = 'assets/characters/seolryeong-character-reference-v2.png'
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

  let time = 0
  return {
    root,
    height: HERO_HEIGHT,
    setExpression(name, holdSeconds) {
      presentation.setExpression(name, holdSeconds)
    },
    setOrbitSwords(count) {
      presentation.setOrbitSwords(count)
    },
    update(dt, speed01, facingAngle) {
      time += dt
      presentation.update(dt, speed01, facingAngle)
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
      geometries.forEach((geometry) => geometry.dispose())
      textures.forEach((texture) => texture.dispose())
      materials.forEach((material) => material.dispose())
      root.removeFromParent()
    },
  }
}
