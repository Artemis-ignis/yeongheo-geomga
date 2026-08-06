/**
 * Procedural item icons.
 *
 * One canvas glyph per 법보/공법, cached as a data URL. Each has to be readable
 * at 32px, so they are bold silhouettes rather than detailed drawings.
 */

import { CHARACTERS } from '../data/characters.js'
import { PASSIVES } from '../data/passives.js'
import { ENEMIES } from '../data/enemies.js'
import { buildEnemyGeometry } from '../art/enemyGeometry.js'
import { buildBossGeometry } from '../art/bossGeometry.js'
import { measureModel, silhouetteMask } from '../art/modelGates.js'

const SIZE = 64
const cache = new Map()

function make(draw, bg) {
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  const ctx = c.getContext('2d')

  const g = ctx.createLinearGradient(0, 0, 0, SIZE)
  g.addColorStop(0, bg[0])
  g.addColorStop(1, bg[1])
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(2, 2, SIZE - 4, SIZE - 4, 10)
  ctx.fill()

  ctx.save()
  ctx.translate(SIZE / 2, SIZE / 2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  draw(ctx)
  ctx.restore()
  return c.toDataURL()
}

const blade = (ctx, color = '#eaf4ff') => {
  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(-14, 16)
  ctx.lineTo(12, -14)
  ctx.stroke()
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-16, 4)
  ctx.lineTo(-4, 16)
  ctx.stroke()
}

const DRAWERS = {
  flyingSword: (ctx) => { blade(ctx); ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 20, -0.6, 1.2); ctx.stroke() },
  myriadSwords: (ctx) => { for (const dx of [-12, 0, 12]) { ctx.save(); ctx.translate(dx, 0); ctx.scale(0.62, 0.62); blade(ctx); ctx.restore() } },

  fireTalisman: (ctx) => {
    ctx.fillStyle = '#ffd9a0'
    ctx.fillRect(-11, -20, 22, 40)
    ctx.strokeStyle = '#c8402a'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke()
    ctx.fillStyle = '#ff7a3c'
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(9, 4, 0, 15); ctx.quadraticCurveTo(-9, 4, 0, -6); ctx.fill()
  },
  infernoSea: (ctx) => {
    for (const dx of [-10, 0, 10]) {
      ctx.fillStyle = dx === 0 ? '#ffb066' : '#ff6a3c'
      ctx.beginPath(); ctx.moveTo(dx, -10); ctx.quadraticCurveTo(dx + 10, 4, dx, 18); ctx.quadraticCurveTo(dx - 10, 4, dx, -10); ctx.fill()
    }
  },

  thunderOrb: (ctx) => {
    ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#fff6a0'
    ctx.beginPath(); ctx.moveTo(2, -16); ctx.lineTo(-8, 2); ctx.lineTo(0, 2); ctx.lineTo(-2, 17); ctx.lineTo(9, -2); ctx.lineTo(1, -2); ctx.closePath(); ctx.fill()
  },
  violetThunder: (ctx) => {
    ctx.fillStyle = '#d0a8ff'
    ctx.beginPath(); ctx.moveTo(4, -20); ctx.lineTo(-10, 2); ctx.lineTo(0, 2); ctx.lineTo(-4, 20); ctx.lineTo(12, -4); ctx.lineTo(2, -4); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#8f6fd0'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke()
  },

  frostPalm: (ctx) => {
    ctx.strokeStyle = '#cfeaff'; ctx.lineWidth = 3
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate((Math.PI / 3) * i)
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -20); ctx.moveTo(0, -12); ctx.lineTo(-6, -17); ctx.moveTo(0, -12); ctx.lineTo(6, -17); ctx.stroke()
      ctx.restore()
    }
  },
  frozenSky: (ctx) => {
    ctx.fillStyle = 'rgba(200,240,255,0.85)'
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(16, -6); ctx.lineTo(11, 16); ctx.lineTo(-11, 16); ctx.lineTo(-16, -6); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#7fc4e8'; ctx.lineWidth = 2; ctx.stroke()
  },

  baguaArray: (ctx) => {
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke()
    ctx.lineWidth = 3
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate((Math.PI / 4) * i); ctx.translate(0, -15)
      ctx.beginPath()
      if (i % 2) { ctx.moveTo(-6, 0); ctx.lineTo(-2, 0); ctx.moveTo(2, 0); ctx.lineTo(6, 0) } else { ctx.moveTo(-6, 0); ctx.lineTo(6, 0) }
      ctx.stroke(); ctx.restore()
    }
  },

  vajra: (ctx) => {
    ctx.strokeStyle = '#f2dca0'; ctx.lineWidth = 6
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 16); ctx.stroke()
    ctx.lineWidth = 4
    for (const y of [-16, 16]) {
      ctx.beginPath(); ctx.moveTo(-9, y > 0 ? y - 8 : y + 8); ctx.lineTo(0, y); ctx.lineTo(9, y > 0 ? y - 8 : y + 8); ctx.stroke()
    }
  },

  spiritButterfly: (ctx) => {
    ctx.fillStyle = '#bfe8ff'
    ctx.beginPath(); ctx.ellipse(-11, -4, 11, 14, 0.5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(11, -4, 11, 14, -0.5, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#6fa8d0'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 16); ctx.stroke()
  },

  skyThunder: (ctx) => {
    ctx.fillStyle = '#cfd8e8'
    ctx.beginPath(); ctx.ellipse(0, -12, 20, 9, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff36a'
    ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(-8, 8); ctx.lineTo(0, 8); ctx.lineTo(-3, 21); ctx.lineTo(10, 4); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill()
  },

  swordArt: (ctx) => { blade(ctx, '#ffd9a0') },
  lightBody: (ctx) => {
    ctx.fillStyle = '#d8f0ff'
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(14, 0, 0, 20); ctx.quadraticCurveTo(-6, 0, 0, -20); ctx.fill()
    ctx.strokeStyle = '#8fb8d0'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 18); ctx.stroke()
  },
  guardianAura: (ctx) => {
    ctx.fillStyle = '#a8d8c0'
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(16, -12); ctx.lineTo(14, 8); ctx.lineTo(0, 20); ctx.lineTo(-14, 8); ctx.lineTo(-16, -12); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#4f8f75'; ctx.lineWidth = 2.5; ctx.stroke()
  },
  spiritRoot: (ctx) => {
    ctx.strokeStyle = '#9be8c8'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, -4); ctx.stroke()
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(-14, -6, -14, -18); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(14, -10, 14, -20); ctx.stroke()
  },
  farSight: (ctx) => {
    ctx.fillStyle = '#eaf4ff'
    ctx.beginPath(); ctx.ellipse(0, 0, 21, 13, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#3c86c8'
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#101828'
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill()
  },
  goldenCore: (ctx) => {
    const g = ctx.createRadialGradient(-5, -5, 1, 0, 0, 20)
    g.addColorStop(0, '#fff6c8')
    g.addColorStop(1, '#e0a33c')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill()
  },

  // 심법 — a struck point, the moment a blow lands where it counts.
  heartMethod: (ctx) => {
    ctx.strokeStyle = '#ff9a7a'; ctx.lineWidth = 3; ctx.lineCap = 'round'
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8)
      ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19)
      ctx.moveTo(-Math.cos(a) * 8, -Math.sin(a) * 8)
      ctx.lineTo(-Math.cos(a) * 19, -Math.sin(a) * 19)
      ctx.stroke()
    }
    ctx.fillStyle = '#fff0d8'
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill()
  },

  // 어검결 — a blade already gone, with the streak it left.
  swordRiding: (ctx) => {
    ctx.strokeStyle = 'rgba(200, 226, 255, 0.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-20, 14); ctx.lineTo(4, -6); ctx.stroke()
    ctx.save(); ctx.rotate(-Math.PI / 4); blade(ctx, '#e8f4ff'); ctx.restore()
  },

  // 분신결 — one becoming three.
  cloneArt: (ctx) => {
    for (const [dx, alpha] of [[-11, 0.4], [0, 1], [11, 0.4]]) {
      ctx.globalAlpha = alpha
      ctx.fillStyle = '#bfe0ff'
      ctx.beginPath(); ctx.ellipse(dx, 0, 6, 17, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  },

  // 연분 — two threads that meet.
  destinedBond: (ctx) => {
    ctx.strokeStyle = '#ffb0c8'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-18, -14); ctx.quadraticCurveTo(0, 4, 18, -14); ctx.stroke()
    ctx.strokeStyle = '#a8c8ff'
    ctx.beginPath(); ctx.moveTo(-18, 16); ctx.quadraticCurveTo(0, -2, 18, 16); ctx.stroke()
    ctx.fillStyle = '#fff2f6'
    ctx.beginPath(); ctx.arc(0, 1, 5, 0, Math.PI * 2); ctx.fill()
  },

  venomMist: (ctx) => {
    ctx.fillStyle = 'rgba(140,224,106,0.55)'
    for (const [x, y, r] of [[-8, 4, 12], [8, 2, 13], [0, -8, 11]]) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = '#2e5a20'
    ctx.beginPath(); ctx.arc(-5, 0, 3, 0, Math.PI * 2); ctx.arc(6, 5, 3, 0, Math.PI * 2); ctx.fill()
  },
  plagueTide: (ctx) => {
    ctx.fillStyle = 'rgba(160,240,120,0.5)'
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      ctx.beginPath(); ctx.arc(Math.cos(a) * 10, Math.sin(a) * 10, 10, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = '#1f4416'
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill()
  },

  hiddenNeedles: (ctx) => {
    ctx.strokeStyle = '#dbe7f2'; ctx.lineWidth = 2.5
    for (let i = 0; i < 5; i++) {
      const a = -0.7 + i * 0.35
      ctx.beginPath()
      ctx.moveTo(Math.sin(a) * 6, 18 - Math.cos(a) * 4)
      ctx.lineTo(Math.sin(a) * 21, -Math.cos(a) * 19)
      ctx.stroke()
    }
  },
  needleStorm: (ctx) => {
    ctx.strokeStyle = '#eaf4ff'; ctx.lineWidth = 2.5
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7)
      ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21)
      ctx.stroke()
    }
  },

  bellToll: (ctx) => {
    ctx.fillStyle = '#e0c882'
    ctx.beginPath()
    ctx.moveTo(-11, 8); ctx.quadraticCurveTo(-11, -12, 0, -14)
    ctx.quadraticCurveTo(11, -12, 11, 8); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#8a6a2e'
    ctx.fillRect(-13, 8, 26, 4)
    ctx.beginPath(); ctx.arc(0, 15, 3.5, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(224,200,130,0.6)'; ctx.lineWidth = 2
    for (const r of [17, 22]) { ctx.beginPath(); ctx.arc(0, -2, r, -0.9, -0.1); ctx.stroke() }
  },

  windBlade: (ctx) => {
    ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 4; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(0, 0, 16, 0.4, Math.PI * 1.5); ctx.stroke()
    ctx.fillStyle = '#eaf4ff'
    ctx.beginPath(); ctx.moveTo(14, -8); ctx.lineTo(22, 2); ctx.lineTo(9, 4); ctx.closePath(); ctx.fill()
  },

  earthSpike: (ctx) => {
    ctx.fillStyle = '#a08a68'
    for (const [x, h] of [[-12, 14], [0, 22], [12, 16]]) {
      ctx.beginPath(); ctx.moveTo(x - 6, 18); ctx.lineTo(x, 18 - h); ctx.lineTo(x + 6, 18); ctx.closePath(); ctx.fill()
    }
    ctx.fillStyle = '#5c4c38'
    ctx.fillRect(-20, 17, 40, 5)
  },

  voidOrb: (ctx) => {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 18)
    g.addColorStop(0, '#0d0820')
    g.addColorStop(0.6, '#6a4fd0')
    g.addColorStop(1, 'rgba(160,130,255,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#d0b8ff'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.ellipse(0, 0, 21, 8, 0.4, 0, Math.PI * 2); ctx.stroke()
  },

  // 단전 permanent upgrades.
  vitality: (ctx) => {
    ctx.fillStyle = '#ff8a9a'
    ctx.beginPath()
    ctx.moveTo(0, 16)
    ctx.bezierCurveTo(-22, 0, -12, -18, 0, -7)
    ctx.bezierCurveTo(12, -18, 22, 0, 0, 16)
    ctx.fill()
  },
  edge: (ctx) => {
    blade(ctx, '#eaf4ff')
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(4, -18); ctx.lineTo(16, -20); ctx.moveTo(8, -12); ctx.lineTo(19, -12); ctx.stroke()
  },
  swift: (ctx) => {
    ctx.strokeStyle = '#9be8c8'; ctx.lineWidth = 4
    for (const y of [-9, 0, 9]) {
      ctx.beginPath(); ctx.moveTo(-18, y); ctx.lineTo(10 - Math.abs(y), y); ctx.stroke()
    }
    ctx.fillStyle = '#9be8c8'
    ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(20, 0); ctx.lineTo(8, 12); ctx.closePath(); ctx.fill()
  },
  circulation: (ctx) => {
    ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(0, 0, 15, 0.5, Math.PI * 1.7); ctx.stroke()
    ctx.fillStyle = '#8fd0ff'
    ctx.beginPath(); ctx.moveTo(14, -8); ctx.lineTo(20, 4); ctx.lineTo(7, 3); ctx.closePath(); ctx.fill()
  },
  bulwark: (ctx) => {
    ctx.fillStyle = '#cfd8e8'
    ctx.beginPath()
    ctx.moveTo(0, -19); ctx.lineTo(15, -11); ctx.lineTo(13, 7); ctx.lineTo(0, 19); ctx.lineTo(-13, 7); ctx.lineTo(-15, -11)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#7a8798'; ctx.lineWidth = 2.5; ctx.stroke()
  },
  reach: (ctx) => {
    ctx.strokeStyle = '#9be8c8'; ctx.lineWidth = 3
    for (const r of [8, 14, 20]) { ctx.beginPath(); ctx.arc(0, 4, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke() }
    ctx.fillStyle = '#9be8c8'
    ctx.beginPath(); ctx.arc(0, 8, 4, 0, Math.PI * 2); ctx.fill()
  },
  insight: (ctx) => {
    ctx.fillStyle = '#eaf4ff'
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#c8a33c'
    ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#101828'
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill()
  },
  mending: (ctx) => {
    ctx.strokeStyle = '#9be8c8'; ctx.lineWidth = 4; ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-19, 2); ctx.lineTo(-9, 2); ctx.lineTo(-4, -11); ctx.lineTo(3, 13); ctx.lineTo(8, 2); ctx.lineTo(19, 2)
    ctx.stroke()
  },
  fortune: (ctx) => {
    ctx.fillStyle = '#e8c56a'
    ctx.beginPath(); ctx.arc(0, 2, 15, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#8a6a1e'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 11); ctx.moveTo(-6, -1); ctx.lineTo(6, -1); ctx.moveTo(-6, 5); ctx.lineTo(6, 5); ctx.stroke()
  },
  revive: (ctx) => {
    const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, 17)
    g.addColorStop(0, '#fff0f4')
    g.addColorStop(1, '#c8467a')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#ffd9e4'; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(0, 0, 20, 0.4, Math.PI * 1.4); ctx.stroke()
  },

  // 점괘 — three cast coins over a broken/solid trigram line. It has to read as
  // "ask again" at 40px, and a hexagram is the one image that says divination
  // without any text.
  insightRoll: (ctx) => {
    ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-14, 9); ctx.lineTo(14, 9); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-14, 16); ctx.lineTo(-4, 16); ctx.moveTo(4, 16); ctx.lineTo(14, 16); ctx.stroke()
    ctx.fillStyle = '#e8c56a'; ctx.strokeStyle = '#8a6a1e'; ctx.lineWidth = 2
    for (const [x, y] of [[-10, -8], [0, -14], [10, -8]]) {
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.strokeRect(x - 2.2, y - 2.2, 4.4, 4.4)
    }
  },
  // 봉인술 — a 부적 strip with a seal struck across it.
  sealing: (ctx) => {
    ctx.fillStyle = '#e2c9a0'
    ctx.fillRect(-10, -19, 20, 38)
    ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 2
    ctx.strokeRect(-10, -19, 20, 38)
    ctx.strokeStyle = '#b04a3a'; ctx.lineWidth = 3; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-5, -11); ctx.lineTo(5, -11); ctx.moveTo(0, -11); ctx.lineTo(0, 4); ctx.stroke()
    ctx.strokeStyle = '#e2764f'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(-16, 13); ctx.lineTo(16, -13); ctx.stroke()
  },

  heal: (ctx) => {
    ctx.fillStyle = '#ff9aa8'
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillRect(-4, -11, 8, 22); ctx.fillRect(-11, -4, 22, 8)
  },
  stones: (ctx) => {
    ctx.fillStyle = '#e8c56a'
    for (const [x, y] of [[-8, 6], [8, 6], [0, -8]]) {
      ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 9, y); ctx.closePath(); ctx.fill()
    }
  },
  purge: (ctx) => {
    ctx.fillStyle = '#d8f4ff'
    ctx.fillRect(-11, -20, 22, 40)
    ctx.strokeStyle = '#4f8f9f'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(5, -10); ctx.moveTo(0, -10); ctx.lineTo(0, 12); ctx.stroke()
  },
}

const BG = {
  weapon: ['#2c3f52', '#16212c'],
  passive: ['#3a3550', '#1e1a2c'],
  evolution: ['#5a4520', '#2c2010'],
  consumable: ['#24463c', '#12241e'],
  meta: ['#3d3348', '#1d1826'],
}

const META_IDS = new Set([
  'vitality', 'edge', 'swift', 'circulation', 'bulwark',
  'reach', 'insight', 'mending', 'fortune', 'revive', 'insightRoll', 'sealing',
])

const EVOLUTION_IDS = new Set([
  'myriadSwords', 'infernoSea', 'violetThunder', 'frozenSky', 'plagueTide', 'needleStorm',
])
/** Derived, so a new 공법 can never fall through to a weapon's background. */
const PASSIVE_IDS = new Set(PASSIVES.map((p) => p.id))
const CONSUMABLE_IDS = new Set(['heal', 'stones', 'purge'])

/**
 * A portrait glyph per cultivator, drawn from her own palette.
 *
 * The 단전 was passing the 혜안 icon for every purchasable character, so all
 * five looked identical on the one screen where the player is deciding which
 * one to buy. Reusing the model here is not an option — these are 32px canvas
 * glyphs — but hair, robe and eye colour are enough to tell them apart, and
 * they are exactly what the player will see in game.
 */
for (const c of CHARACTERS) {
  const pal = c.palette
  const hex = (n) => `#${n.toString(16).padStart(6, '0')}`
  DRAWERS[c.id] = (ctx) => {
    // Shoulders.
    ctx.fillStyle = hex(pal.cloth)
    ctx.beginPath()
    ctx.moveTo(-22, 26)
    ctx.quadraticCurveTo(-16, 6, 0, 6)
    ctx.quadraticCurveTo(16, 6, 22, 26)
    ctx.closePath()
    ctx.fill()
    // Hair behind the head.
    ctx.fillStyle = hex(pal.hair)
    ctx.beginPath()
    ctx.ellipse(0, -6, 19, 21, 0, 0, Math.PI * 2)
    ctx.fill()
    // Face.
    ctx.fillStyle = hex(pal.skin)
    ctx.beginPath()
    ctx.ellipse(0, -3, 13, 15, 0, 0, Math.PI * 2)
    ctx.fill()
    // Fringe over the brow, so the hair colour reads on top too.
    ctx.fillStyle = hex(pal.hair)
    ctx.beginPath()
    ctx.ellipse(0, -14, 16, 10, 0, Math.PI, Math.PI * 2)
    ctx.fill()
    // Eyes: the only saturated marks, so they carry at small sizes.
    ctx.fillStyle = hex(pal.eye)
    for (const dx of [-6, 6]) {
      ctx.beginPath()
      ctx.ellipse(dx, -2, 3.2, 4.2, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/**
 * Creature icons, rasterised from the creature's own model.
 *
 * The 도감 was falling through to the generic grey circle for all thirteen
 * 요괴 and both bosses, so the one screen whose entire purpose is telling them
 * apart showed fifteen identical discs. Hand-drawing that many glyphs would
 * also mean maintaining a second, silently-diverging picture of every model.
 *
 * The gate module already rasterises a silhouette mask to measure how a
 * creature reads — the same mask, filled with the model's dominant vertex
 * colour, is the icon. It cannot drift from the model because it is derived
 * from it.
 */
function creatureDrawer(build, id) {
  return (ctx) => {
    const { res, mask } = silhouetteMask(build(id), 0.35)
    const hex = measureModel(build(id)).dominant
    const r = (hex >> 16) & 255
    const g = (hex >> 8) & 255
    const b = hex & 255
    const cell = (SIZE - 14) / res
    // Drawn twice: a dark offset copy for weight, then the creature's colour.
    for (const [ox, oy, fill] of [[1.5, 1.5, 'rgba(0,0,0,0.55)'], [0, 0, `rgb(${r},${g},${b})`]]) {
      ctx.fillStyle = fill
      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          if (mask[y * res + x] === 0) continue
          // The mask has y up; canvas has y down.
          ctx.fillRect(
            (x - res / 2) * cell + ox,
            (res / 2 - 1 - y) * cell + oy,
            cell + 0.6, cell + 0.6,
          )
        }
      }
    }
  }
}

for (const e of ENEMIES) DRAWERS[e.id] = creatureDrawer(buildEnemyGeometry, e.id)
for (const id of ['blueWolfKing', 'darkHeavenLord', 'riverMaiden', 'jadeVoidWarden']) {
  DRAWERS[id] = creatureDrawer(buildBossGeometry, id)
}

const CREATURE_IDS = new Set([...ENEMIES.map((e) => e.id), 'blueWolfKing', 'darkHeavenLord', 'riverMaiden', 'jadeVoidWarden'])
const CHARACTER_IDS = new Set(CHARACTERS.map((c) => c.id))

function bgFor(id) {
  if (CREATURE_IDS.has(id)) return BG.meta
  if (CHARACTER_IDS.has(id)) return BG.passive
  if (META_IDS.has(id)) return BG.meta
  if (EVOLUTION_IDS.has(id)) return BG.evolution
  if (PASSIVE_IDS.has(id)) return BG.passive
  if (CONSUMABLE_IDS.has(id)) return BG.consumable
  return BG.weapon
}

export function iconFor(id) {
  let url = cache.get(id)
  if (url === undefined) {
    const draw = DRAWERS[id] ?? ((ctx) => {
      ctx.strokeStyle = '#8fa0b0'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(0, 0, 14, 0, Math.PI * 2)
      ctx.stroke()
    })
    url = make(draw, bgFor(id))
    cache.set(id, url)
  }
  return url
}
