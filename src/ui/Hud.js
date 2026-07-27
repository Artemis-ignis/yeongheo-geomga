import { iconFor } from './icons.js'
import { MAX_WEAPON_SLOTS, MAX_PASSIVE_SLOTS } from '../combat/upgrades.js'

const HP_GHOST_LAG = 2.4

function el(tag, cls, parent) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (parent) parent.appendChild(node)
  return node
}

/**
 * The in-run HUD, as real DOM over the canvas.
 *
 * Every number updates by writing textContent on a cached node reference —
 * nothing here rebuilds innerHTML per frame.
 */
export class Hud {
  constructor(root) {
    this.root = root
    this.node = el('div', 'hud-run', root)
    this.ghostHp = 1

    // Top centre: realm, timer, XP.
    const top = el('div', 'hud-top', this.node)
    this.realm = el('div', 'hud-realm', top)
    this.timer = el('div', 'hud-timer', top)
    const xpTrack = el('div', 'hud-xp', top)
    this.xpFill = el('div', 'hud-xp-fill', xpTrack)

    // Top left: counters.
    const left = el('div', 'hud-counters', this.node)
    this.kills = el('div', 'hud-count', left)
    this.stones = el('div', 'hud-count', left)

    // Bottom left: health and dash.
    const bl = el('div', 'hud-vitals', this.node)
    const hpTrack = el('div', 'hud-hp', bl)
    this.hpGhost = el('div', 'hud-hp-ghost', hpTrack)
    this.hpFill = el('div', 'hud-hp-fill', hpTrack)
    this.hpText = el('div', 'hud-hp-text', hpTrack)
    const dash = el('div', 'hud-dash', bl)
    this.dashPip = el('div', 'hud-dash-pip', dash)
    el('span', null, dash).textContent = '축지법'

    // Boss bar, hidden until a boss is alive.
    this.bossWrap = el('div', 'hud-boss', this.node)
    this.bossName = el('div', 'hud-boss-name', this.bossWrap)
    const bossTrack = el('div', 'hud-boss-track', this.bossWrap)
    this.bossFill = el('div', 'hud-boss-fill', bossTrack)
    this.bossWrap.style.display = 'none'

    // Bottom right: slots.
    const slots = el('div', 'hud-slots', this.node)
    this.weaponSlots = this._buildRow(slots, MAX_WEAPON_SLOTS, 'weapon')
    this.passiveSlots = this._buildRow(slots, MAX_PASSIVE_SLOTS, 'passive')
  }

  _buildRow(parent, count, kind) {
    const row = el('div', `hud-slot-row hud-slot-${kind}`, parent)
    const slots = []
    for (let i = 0; i < count; i++) {
      const slot = el('div', 'hud-slot', row)
      const img = el('img', 'hud-slot-icon', slot)
      img.alt = ''
      const pips = el('div', 'hud-pips', slot)
      const pipNodes = []
      for (let p = 0; p < 5; p++) pipNodes.push(el('i', null, pips))
      slots.push({ slot, img, pipNodes, id: null, level: 0 })
    }
    return slots
  }

  _syncRow(slots, items) {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      const item = items[i]
      if (!item) {
        if (s.id !== null) {
          s.id = null
          s.level = 0
          s.slot.classList.remove('filled')
          s.img.removeAttribute('src')
          for (const p of s.pipNodes) p.classList.remove('on')
        }
        continue
      }
      if (s.id !== item.id) {
        s.id = item.id
        s.img.src = iconFor(item.id)
        s.slot.classList.add('filled')
        s.level = 0
      }
      if (s.level !== item.level) {
        s.level = item.level
        for (let p = 0; p < s.pipNodes.length; p++) {
          s.pipNodes[p].classList.toggle('on', p < item.level)
        }
        // Restart the flash animation on change.
        s.slot.classList.remove('flash')
        void s.slot.offsetWidth
        s.slot.classList.add('flash')
      }
    }
  }

  update(state, dt) {
    this.realm.textContent = `${state.realm.name} ${state.realm.hanja} · ${state.level}층`
    const m = Math.floor(state.runTime / 60)
    const s = Math.floor(state.runTime % 60)
    this.timer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    this.xpFill.style.width = `${Math.min(100, (state.xp / Math.max(1, state.xpNeeded)) * 100)}%`

    this.kills.textContent = `처치 ${state.kills}`
    this.stones.textContent = `영석 ${state.stones}`

    const hpRatio = Math.max(0, state.hp / Math.max(1, state.maxHp))
    this.hpFill.style.width = `${hpRatio * 100}%`
    // The ghost lags behind so the player can see how much was just lost.
    this.ghostHp += (hpRatio - this.ghostHp) * Math.min(1, HP_GHOST_LAG * dt)
    if (this.ghostHp < hpRatio) this.ghostHp = hpRatio
    this.hpGhost.style.width = `${this.ghostHp * 100}%`
    this.hpText.textContent = `${Math.ceil(state.hp)} / ${Math.round(state.maxHp)}`

    const ready = state.dashCooldown <= 0
    this.dashPip.classList.toggle('ready', ready)
    this.dashPip.style.setProperty('--fill', `${ready ? 100 : (1 - state.dashCooldown / 3) * 100}%`)

    this._syncRow(this.weaponSlots, state.weapons)
    this._syncRow(this.passiveSlots, state.passives)

    if (state.boss) {
      this.bossWrap.style.display = ''
      this.bossName.textContent = `${state.boss.name} ${state.boss.hanja}`
      this.bossFill.style.width = `${Math.max(0, (state.boss.hp / state.boss.maxHp) * 100)}%`
    } else {
      this.bossWrap.style.display = 'none'
    }
  }

  show() { this.node.style.display = '' }
  hide() { this.node.style.display = 'none' }

  dispose() {
    this.node.remove()
  }
}
