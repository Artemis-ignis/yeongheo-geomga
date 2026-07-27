import * as THREE from 'three'
import { glowTexture, baguaTexture } from './textures.js'

export const MAX_VFX = 400

const _dummy = new THREE.Object3D()

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
      uniform float uTime;
      uniform float uGrow;
      uniform float uSpin;
      varying vec2 vUv;
      varying float vFade;

      void main() {
        float age = ( uTime - aBirth ) / max( aLife, 0.0001 );
        vFade = 1.0 - clamp( age, 0.0, 1.0 );
        vUv = uv;

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

      void main() {
        vec4 tex = uHasMap > 0.5 ? texture2D( uMap, vUv ) : vec4( 1.0 );
        float a = tex.a * vFade;
        if ( a < 0.01 ) discard;
        gl_FragColor = vec4( uColor * tex.rgb, a );
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
    geo.setAttribute('aBirth', new THREE.InstancedBufferAttribute(this.birth, 1))
    geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(this.life, 1))

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
  emit(x, y, z, scale, life, time, rotY = 0, flat = false) {
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
    this.geo.attributes.aBirth.needsUpdate = true
    this.geo.attributes.aLife.needsUpdate = true
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
      telegraph: new EffectLayer(scene, ring, makeEffectMaterial({ color: 0xffd0d0, grow: -0.65 }), 32),
      pillar: new EffectLayer(scene, cyl, makeEffectMaterial({ color: 0xfff2c8, grow: 0.4 }), 16),
      bolt: new EffectLayer(scene, quad, makeEffectMaterial({ color: 0xd8c8ff, map: glowTexture(), grow: 0.6 }), 60),
      array: new EffectLayer(scene, quad, makeEffectMaterial({ color: 0xffe08a, map: baguaTexture(), grow: 0.3, spin: 2 }), 24),
    }
  }

  spark(x, z, y = 0.8, scale = 0.9) {
    this.layers.spark.emit(x, y, z, scale, 0.28, this.time)
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
