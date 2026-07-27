/**
 * Procedural item icons.
 *
 * One canvas glyph per 법보/공법, cached as a data URL. Each has to be readable
 * at 32px, so they are bold silhouettes rather than detailed drawings.
 */

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
}

const EVOLUTION_IDS = new Set(['myriadSwords', 'infernoSea', 'violetThunder', 'frozenSky'])
const PASSIVE_IDS = new Set(['swordArt', 'lightBody', 'guardianAura', 'spiritRoot', 'farSight', 'goldenCore'])
const CONSUMABLE_IDS = new Set(['heal', 'stones', 'purge'])

function bgFor(id) {
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
