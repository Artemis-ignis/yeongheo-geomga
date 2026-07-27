import * as THREE from 'three'
import { makeAdditiveMaterial } from '../../art/materials.js'
import { baguaTexture } from '../../art/textures.js'

/**
 * 팔괘진 — a formation under the cultivator that grinds down anything inside it.
 *
 * Runs on its own timer inside `update` rather than the standard fire cadence,
 * so the ring stays continuously visible between damage ticks.
 */
function attach(ctx) {
  const state = ctx.state
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    makeAdditiveMaterial({ color: 0xffd98a, opacity: 0.5, map: baguaTexture() }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.frustumCulled = false
  ctx.world.scene.add(mesh)
  state.mesh = mesh
  state.timer = 0
  state.spin = 0
}

function detach(ctx) {
  const state = ctx.state
  if (!state.mesh) return
  state.mesh.geometry.dispose()
  state.mesh.material.dispose()
  state.mesh.removeFromParent()
  state.mesh = null
}

export const baguaArray = {
  attach,
  detach,

  update(ctx, dt) {
    const state = ctx.state
    if (!state.mesh) return
    const { player, world, level, stats } = ctx
    const radius = 3.0 * ctx.area

    state.spin += dt * 0.6
    state.mesh.position.set(player.x, 0.06, player.z)
    state.mesh.scale.setScalar(radius * 2)
    state.mesh.rotation.z = state.spin
    state.mesh.material.opacity = 0.38 + Math.sin(state.spin * 3) * 0.08

    state.timer -= dt
    if (state.timer > 0) return
    state.timer += ctx.cooldown
    world.enemies.damageAt(player.x, player.z, radius, level.damage, ctx.weapon.tag, stats, {
      knockback: 0,
    })
  },
}
