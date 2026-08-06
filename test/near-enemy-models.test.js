import * as THREE from 'three'
import { describe, expect, it, afterEach } from 'vitest'
import {
  createNearEnemyModel,
  disposeNearEnemyModelLibrary,
  NEAR_DETAIL_ENEMY_IDS,
  updateNearEnemyModel,
} from '../src/art/NearEnemyModels.js'

afterEach(() => {
  disposeNearEnemyModelLibrary()
})

describe('near enemy presentation models', () => {
  it('covers the stage bestiary with an explicit bounded-detail allowlist', () => {
    expect(NEAR_DETAIL_ENEMY_IDS.has('wisp')).toBe(true)
    expect(NEAR_DETAIL_ENEMY_IDS.has('jadeSerpent')).toBe(true)
    expect(NEAR_DETAIL_ENEMY_IDS.has('glacierWarden')).toBe(true)
    expect(NEAR_DETAIL_ENEMY_IDS.size).toBeGreaterThanOrEqual(7)
  })

  it('builds grounded layered geometry instead of a single primitive blob', () => {
    const root = createNearEnemyModel('demonCultivator', 1.22)
    expect(root).toBeTruthy()
    expect(root.name).toBe('near-enemy-demonCultivator')

    const meshes = []
    root.traverse((object) => { if (object.isMesh) meshes.push(object) })
    expect(meshes.length).toBeGreaterThanOrEqual(8)

    root.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(root)
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01)
    expect(bounds.max.y).toBeGreaterThan(1.5)

    updateNearEnemyModel(root, 2.5, 0.8, 1.4)
    expect(root.getObjectByName('near-motion').position.y).not.toBeNaN()
  })
})
