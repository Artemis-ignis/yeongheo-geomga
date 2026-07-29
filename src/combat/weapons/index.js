import { flyingSword } from './flyingSword.js'
import { fireTalisman } from './fireTalisman.js'
import { thunderOrb } from './thunderOrb.js'
import { frostPalm } from './frostPalm.js'
import { baguaArray } from './baguaArray.js'
import { vajra } from './vajra.js'
import { spiritButterfly } from './spiritButterfly.js'
import { skyThunder } from './skyThunder.js'
import { myriadSwords, infernoSea, violetThunder, frozenSky } from './evolutions.js'
import {
  venomMist, plagueTide, hiddenNeedles, needleStorm,
  bellToll, windBlade, earthSpike, voidOrb,
} from './extras.js'

/**
 * id → weapon module. Each module is
 * `{ fire?(ctx), update?(ctx, dt), attach?(ctx), detach?(ctx) }`.
 *
 * Modules receive a reused context and request projectiles and effects through
 * `ctx.world`; they never touch the renderer directly.
 */
export const WEAPON_MODULES = {
  flyingSword,
  fireTalisman,
  thunderOrb,
  frostPalm,
  baguaArray,
  vajra,
  spiritButterfly,
  skyThunder,
  venomMist,
  hiddenNeedles,
  bellToll,
  windBlade,
  earthSpike,
  voidOrb,
  myriadSwords,
  infernoSea,
  violetThunder,
  frozenSky,
  plagueTide,
  needleStorm,
}

export function getWeaponModule(id) {
  return WEAPON_MODULES[id]
}
