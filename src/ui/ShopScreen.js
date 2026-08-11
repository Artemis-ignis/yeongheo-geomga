import { iconFor } from './icons.js'
import { META_UPGRADES } from '../data/metaUpgrades.js'
import { CHARACTER_UNLOCKS, WEAPON_UNLOCKS } from '../data/unlocks.js'
import { getCharacter, isReleasePlayableCharacter } from '../data/characters.js'
import { getWeapon } from '../data/weapons.js'

/**
 * 단전 — spend 영석 on permanent upgrades and unlocks.
 *
 * Every purchase writes through immediately via the `onChange` callback, so
 * closing the tab mid-shopping never loses a purchase.
 */
export class ShopScreen {
  constructor(root, progress, onChange) {
    this.progress = progress
    this.onChange = onChange
    this.onClose = null

    this.node = document.createElement('div')
    this.node.className = 'screen'
    this.node.style.display = 'none'
    this.node.innerHTML = `
      <div class="screen-inner shop-inner">
        <div class="shop-head">
          <div class="shop-title">단전</div>
          <div class="shop-stones"></div>
        </div>
        <div class="shop-scroll">
          <div class="shop-section">영구 강화</div>
          <div class="shop-grid"></div>
          <div class="shop-section">해금</div>
          <div class="shop-grid shop-unlocks"></div>
        </div>
        <button class="btn btn-alt clickable" data-act="back">← 돌아가기</button>
      </div>`
    root.appendChild(this.node)

    this.stonesLabel = this.node.querySelector('.shop-stones')
    this.grid = this.node.querySelector('.shop-grid')
    this.unlockGrid = this.node.querySelector('.shop-unlocks')
    this.node.querySelector('[data-act="back"]').addEventListener('click', () => this.close())

    this.rows = META_UPGRADES.map((up) => {
      const row = document.createElement('button')
      row.className = 'shop-card clickable'
      row.innerHTML = `
        <img class="shop-icon" alt="" src="${iconFor(up.id)}" />
        <div class="shop-body">
          <div class="shop-name">${up.name}</div>
          <div class="shop-desc">${up.desc}</div>
          <div class="shop-pips"></div>
        </div>
        <div class="shop-cost"></div>`
      const pips = row.querySelector('.shop-pips')
      const pipNodes = []
      for (let i = 0; i < up.max; i++) pipNodes.push(pips.appendChild(document.createElement('i')))
      row.addEventListener('click', () => this._buy(up.id))
      this.grid.appendChild(row)
      return { up, row, pipNodes, cost: row.querySelector('.shop-cost') }
    })

    this.unlockRows = [
      ...CHARACTER_UNLOCKS
        .filter((u) => isReleasePlayableCharacter(u.id))
        .map((u) => ({ kind: 'characters', ...u })),
      ...WEAPON_UNLOCKS.map((u) => ({ kind: 'weapons', ...u })),
    ].map((u) => {
      const def = u.kind === 'characters' ? getCharacter(u.id) : getWeapon(u.id)
      const row = document.createElement('button')
      row.className = 'shop-card clickable'
      row.innerHTML = `
        <img class="shop-icon" alt="" src="${iconFor(u.id)}" />
        <div class="shop-body">
          <div class="shop-name">${def?.name ?? u.id}</div>
          <div class="shop-desc">${u.kind === 'characters' ? '플레이 가능한 수사' : '돌파 보상에 등장하는 법보'}</div>
        </div>
        <div class="shop-cost"></div>`
      row.addEventListener('click', () => this._unlock(u.kind, u.id))
      this.unlockGrid.appendChild(row)
      // `price` is the number, `costNode` the element — naming both `cost` had
      // the node shadow the value.
      return { kind: u.kind, id: u.id, price: u.cost, row, costNode: row.querySelector('.shop-cost') }
    })
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  show(onClose) {
    this.onClose = onClose
    this.node.style.display = ''
    this.refresh()
  }

  _buy(id) {
    if (!this.progress.buyUpgrade(id)) return
    this.onChange?.()
    this.refresh()
  }

  _unlock(kind, id) {
    if (!this.progress.unlock(kind, id)) return
    this.onChange?.()
    this.refresh()
  }

  refresh() {
    const stones = this.progress.stones
    this.stonesLabel.textContent = `영석 ${stones}`

    for (const r of this.rows) {
      const level = this.progress.levelOf(r.up.id)
      for (let i = 0; i < r.pipNodes.length; i++) r.pipNodes[i].classList.toggle('on', i < level)

      const maxed = this.progress.isMaxed(r.up.id)
      const cost = this.progress.costOf(r.up.id)
      r.cost.textContent = maxed ? 'MAX' : `${cost}`
      r.row.classList.toggle('maxed', maxed)
      r.row.classList.toggle('affordable', !maxed && this.progress.canAfford(r.up.id))
      r.row.disabled = maxed || !this.progress.canAfford(r.up.id)
    }

    for (const r of this.unlockRows) {
      const owned = this.progress.isUnlocked(r.kind, r.id)
      r.costNode.textContent = owned ? '보유' : String(r.price)
      r.row.classList.toggle('maxed', owned)
      r.row.classList.toggle('affordable', !owned && this.progress.canAffordUnlock(r.kind, r.id))
      r.row.disabled = owned || !this.progress.canAffordUnlock(r.kind, r.id)
    }
  }

  handleKey(confirm) {
    if (this.isOpen && confirm) this.close()
  }

  close() {
    this.node.style.display = 'none'
    const cb = this.onClose
    this.onClose = null
    if (cb) cb()
  }

  dispose() {
    this.node.remove()
  }
}
