import * as THREE from 'three'
import { glowTexture, baguaTexture } from './textures.js'

export const MAX_VFX = 400

const _dummy = new THREE.Object3D()

/**
 * Impact colour per damage element. The layer's own colour is a warm spark, so
 * these are multipliers against it rather than absolute colours.
 */
/** Launch flash per projectile kind, matched to the 법보 that throws it. */
const LAUNCH_TINTS = {
  sword: [0.82, 0.94, 1.2],
  talisman: [1.2, 0.62, 0.28],
  vajra: [1.15, 0.98, 0.5],
  butterfly: [0.7, 1.0, 1.25],
  darkSword: [0.85, 0.6, 1.25],
  enemyShot: [0.8, 0.55, 1.1],
}

const HIT_TINTS = {
  physical: [1.0, 0.95, 0.85],
  sword: [0.85, 0.95, 1.15],
  fire: [1.15, 0.55, 0.22],
  ice: [0.55, 0.95, 1.25],
  thunder: [0.85, 0.8, 1.3],
  array: [1.1, 0.95, 0.5],
  poison: [0.6, 1.15, 0.5],
  wind: [0.8, 1.1, 0.95],
}

/**
 * Pooled, instanced visual effects.
 *
 * Every effect kind is one InstancedMesh. Fade and growth run in the fragment/
 * vertex shader from a per-instance birth time, so the CPU writes a matrix once
 * at spawn and nothing per frame.
 */

function makeEffectMaterial({ color, additive = true, map = null, grow = 1.0, spin = 0 }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uMap: { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uGrow: { value: grow },
      uSpin: { value: spin },
    },
    vertexShader: `
      attribute float aBirth;
      attribute float aLife;
      // Per-instance tint, so one layer can serve every damage element instead
      // of needing a separate InstancedMesh and draw call for each.
      attribute vec3 aTint;
      uniform float uTime;
      uniform float uGrow;
      uniform float uSpin;
      varying vec2 vUv;
      varying float vFade;
      varying vec3 vTint;

      void main() {
        float age = ( uTime - aBirth ) / max( aLife, 0.0001 );
        vFade = 1.0 - clamp( age, 0.0, 1.0 );
        vUv = uv;
        vTint = aTint;

        vec3 p = position * ( 1.0 + age * uGrow );
        if ( uSpin != 0.0 ) {
          float a = age * uSpin;
          float c = cos( a ), s = sin( a );
          p.xy = mat2( c, -s, s, c ) * p.xy;
        }
        // Dead instances are collapsed to a point instead of being culled, which
        // keeps the instance buffer contiguous.
        if ( age >= 1.0 ) p *= 0.0;

        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( p, 1.0 );
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform sampler2D uMap;
      uniform float uHasMap;
      varying vec2 vUv;
      varying float vFade;
      varying vec3 vTint;

      void main() {
        vec4 tex = uHasMap > 0.5 ? texture2D( uMap, vUv ) : vec4( 1.0 );
        float a = tex.a * vFade;
        if ( a < 0.01 ) discard;
        gl_FragColor = vec4( uColor * vTint * tex.rgb, a );
      }`,
  })
}

class EffectLayer {
  constructor(scene, geometry, material, capacity) {
    this.capacity = capacity
    this.next = 0
    this.material = material

    const geo = new THREE.InstancedBufferGeometry()
    geo.index = geometry.index
    geo.attributes = geometry.attributes
    geo.instanceCount = capacity

    this.birth = new Float32Array(capacity).fill(-1000)
    this.life = new Float32Array(capacity).fill(1)
    this.tint = new Float32Array(capacity * 3).fill(1)
    geo.setAttribute('aBirth', new THREE.InstancedBufferAttribute(this.birth, 1))
    geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(this.life, 1))
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(this.tint, 3))

    this.mesh = new THREE.InstancedMesh(geo, material, capacity)
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    for (let i = 0; i < capacity; i++) {
      _dummy.position.set(0, -9999, 0)
      _dummy.scale.setScalar(0.001)
      _dummy.updateMatrix()
      this.mesh.setMatrixAt(i, _dummy.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
    scene.add(this.mesh)
    this.geo = geo
  }

  /** Ring-buffer spawn: the oldest effect is overwritten when full. */
  emit(x, y, z, scale, life, time, rotY = 0, flat = false, tint = null) {
    const i = this.next % this.capacity
    this.next++
    _dummy.position.set(x, y, z)
    _dummy.rotation.set(flat ? -Math.PI / 2 : 0, rotY, 0)
    _dummy.scale.setScalar(scale)
    _dummy.updateMatrix()
    this.mesh.setMatrixAt(i, _dummy.matrix)
    this.mesh.instanceMatrix.needsUpdate = true
    this.birth[i] = time
    this.life[i] = life
    // White leaves the layer's own colour untouched, so every existing caller
    // keeps working without passing a tint.
    this.tint[i * 3] = tint ? tint[0] : 1
    this.tint[i * 3 + 1] = tint ? tint[1] : 1
    this.tint[i * 3 + 2] = tint ? tint[2] : 1
    this.geo.attributes.aBirth.needsUpdate = true
    this.geo.attributes.aLife.needsUpdate = true
    this.geo.attributes.aTint.needsUpdate = true
  }

  setTime(t) {
    this.material.uniforms.uTime.value = t
  }

  dispose() {
    this.geo.dispose()
    this.material.dispose()
    this.mesh.removeFromParent()
  }
}

export class Vfx {
  constructor(scene) {
    this.time = 0
    const quad = new THREE.PlaneGeometry(1, 1)
    const ring = new THREE.RingGeometry(0.72, 1, 32)
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true)

    this.layers = {
      spark: new EffectLayer(scene, quad, makeEffectMaterial({ color: 0xfff0c0, map: glowTexture(), grow: 1.6 }), 140),
      burst: new EffectLayer(scene, quad, makeEffectMaterial({ color: 0xff9a4d, map: glowTexture(), grow: 2.2 }), 60),
      puff: new EffectLayer(scene, quad, makeEffectMaterial({ color: 0xc8a8ff, map: glowTexture(), grow: 1.9 }), 80),
      ring: new EffectLayer(scene, ring, makeEffectMaterial({ color: 0xbff5e2, grow: 3.0 }), 40),
      // Telegraphs converge instead of expanding, so they read as "something is
      // about to land here" rather than "something just went off".
      //
      // Deliberately dim. These are additive and several overlap whenever more
      // than one creature winds up, and at full brightness a handful of them
      // stacked into solid white discs that were the loudest thing on screen —
      // louder than the attack they were warning about. A warning should be
      // legible, not blinding.
      telegraph: new EffectLayer(scene, ring, makeEffectMaterial({ color: 0x8f4038, grow: -0.65 }), 48),
      pillar: new EffectLayer(scene, cyl, makeEffectMaterial({ color: 0xfff2c8, grow: 0.4 }), 16),
      bolt: new EffectLayer(scene, quad, makeEffectMaterial({ color: 0xd8c8ff, map: glowTexture(), grow: 0.6 }), 60),
      array: new EffectLayer(scene, quad, makeEffectMaterial({ color: 0xffe08a, map: baguaTexture(), grow: 0.3, spin: 2 }), 24),
    }
  }

  spark(x, z, y = 0.8, scale = 0.9) {
    this.layers.spark.emit(x, y, z, scale, 0.28, this.time)
  }

  /**
   * The moment a 법보 leaves her hand.
   *
   * Shots previously just appeared. A launch flash in the weapon's own colour
   * is what makes a loadout feel like several distinct things firing rather
   * than one emitter changing hue — and unlike the trail it happens at a fixed
   * point the player is already looking at.
   */
  launch(x, z, dirX, dirZ, kind) {
    const tint = LAUNCH_TINTS[kind] ?? LAUNCH_TINTS.sword
    // Pushed slightly ahead so the flash sits at the muzzle, not inside her.
    this.layers.spark.emit(
      x + dirX * 0.55, 0.95, z + dirZ * 0.55,
      0.42, 0.16, this.time, 0, false, tint,
    )
    this.layers.ring.emit(
      x + dirX * 0.7, 0.12, z + dirZ * 0.7,
      0.75, 0.18, this.time, 0, true, tint,
    )
  }

  /**
   * The moment a weapon connects.
   *
   * Landing a hit used to produce a damage number and a white flash on the
   * creature, and nothing at the point of contact — which is why the combat
   * read as numbers going up rather than as blows landing. A cluster of sparks
   * thrown along the direction of the blow, tinted to the element, is most of
   * what the feel was missing, and it costs one instanced quad per spark.
   */
  hit(x, z, tag = 'physical', crit = false, dirX = 0, dirZ = 0, power = 1) {
    const tint = HIT_TINTS[tag] ?? HIT_TINTS.physical
    const len = Math.hypot(dirX, dirZ) || 1
    const nx = dirX / len
    const nz = dirZ / len
    const count = crit ? 6 : 3

    for (let i = 0; i < count; i++) {
      // Thrown along the blow, spread wider the harder it landed.
      const spread = (i / Math.max(1, count - 1) - 0.5) * (crit ? 1.5 : 0.95)
      const c = Math.cos(spread)
      const s = Math.sin(spread)
      const ox = nx * c - nz * s
      const oz = nx * s + nz * c
      const reach = 0.35 + i * 0.16
      // Small and quick. Large soft quads at this camera angle read as blobs
      // sitting on the creature rather than as anything being struck.
      this.layers.spark.emit(
        x + ox * reach, 0.7 + (i % 2) * 0.45, z + oz * reach,
        (crit ? 0.42 : 0.26) * power, crit ? 0.26 : 0.17, this.time, 0, false, tint,
      )
    }
    // A flat flash under the contact. With the camera looking down, the ground
    // plane is the surface the player actually reads, so this carries most of
    // the hit and the airborne sparks only garnish it.
    this.layers.ring.emit(
      x, 0.1, z, (crit ? 1.7 : 1.05) * power, crit ? 0.3 : 0.2, this.time, 0, true, tint,
    )
  }

  burst(x, z, radius, y = 0.8) {
    this.layers.burst.emit(x, y, z, radius * 1.4, 0.42, this.time)
  }

  deathPuff(x, z, y = 0.7) {
    this.layers.puff.emit(x, y, z, 1.1, 0.38, this.time)
  }

  shockRing(x, z, radius) {
    this.layers.ring.emit(x, 0.12, z, radius, 0.7, this.time, 0, true)
  }

  telegraph(x, z, radius, life = 0.4) {
    this.layers.telegraph.emit(x, 0.14, z, radius, life, this.time, 0, true)
  }

  pillar(x, z) {
    this.layers.pillar.emit(x, 6, z, 2.2, 0.85, this.time)
  }

  lightning(x, z, scale = 1.6) {
    this.layers.bolt.emit(x, 1.4, z, scale, 0.3, this.time)
  }

  arrayFlash(x, z, radius) {
    this.layers.array.emit(x, 0.14, z, radius * 2, 0.5, this.time, 0, true)
  }

  update(dt) {
    this.time += dt
    for (const k in this.layers) this.layers[k].setTime(this.time)
  }

  clear() {
    for (const k in this.layers) this.layers[k].birth.fill(-1000)
  }

  dispose() {
    for (const k in this.layers) this.layers[k].dispose()
  }
}
