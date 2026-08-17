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
    this.node.className = 'screen shop-screen'
    this.node.setAttribute('role', 'dialog')
    this.node.setAttribute('aria-modal', 'true')
    this.node.setAttribute('aria-labelledby', 'shop-screen-title')
    this.node.setAttribute('aria-hidden', 'true')
    this.node.style.display = 'none'
    this.node.innerHTML = `
      <div class="screen-inner shop-inner">
        <div class="shop-head">
          <div class="shop-heading">
            <div class="shop-kicker">內景 · 영맥을 다스리는 곳</div>
            <div class="shop-title" id="shop-screen-title">단전</div>
            <p class="shop-lead">출정에서 거둔 영석으로 다음 생의 근골과 법보 인연을 닦습니다.</p>
          </div>
          <div class="shop-stones"></div>
        </div>
        <div class="collection-tabs shop-tabs" role="tablist" aria-label="단전 수련 분류" aria-orientation="horizontal">
          <button class="collection-tab clickable" type="button" role="tab" id="shop-tab-cultivation" data-shop-tab="cultivation" aria-controls="shop-pane-cultivation">
            <span aria-hidden="true">壹</span>
            <b>근골 수련</b>
            <small>모든 출정에 이어지는 영구 강화</small>
          </button>
          <button class="collection-tab clickable" type="button" role="tab" id="shop-tab-affinity" data-shop-tab="affinity" aria-controls="shop-pane-affinity">
            <span aria-hidden="true">貳</span>
            <b>수사 · 법보 인연</b>
            <small>새 전투 방식과 인연을 해금</small>
          </button>
        </div>
        <div class="shop-scroll shop-workbench">
          <section class="shop-pane" id="shop-pane-cultivation" role="tabpanel" aria-labelledby="shop-tab-cultivation" data-shop-pane="cultivation">
            <div class="shop-section">영맥 각인 <small>영석을 들여 다음 생의 바탕을 세웁니다.</small></div>
            <div class="shop-grid" role="group" aria-label="영구 강화 목록"></div>
          </section>
          <section class="shop-pane" id="shop-pane-affinity" role="tabpanel" aria-labelledby="shop-tab-affinity" data-shop-pane="affinity">
            <div class="shop-section">인연 명부 <small>해금한 수사와 법보는 이후 출정에 나타납니다.</small></div>
            <div class="shop-grid shop-unlocks" role="group" aria-label="수사와 법보 해금 목록"></div>
          </section>
        </div>
        <button class="btn btn-alt btn-back clickable" data-act="back">검가로 돌아간다</button>
      </div>`
    root.appendChild(this.node)

    this.stonesLabel = this.node.querySelector('.shop-stones')
    this.grid = this.node.querySelector('.shop-grid')
    this.unlockGrid = this.node.querySelector('.shop-unlocks')
    this.tabs = [...this.node.querySelectorAll('[data-shop-tab]')]
    this.panes = [...this.node.querySelectorAll('[data-shop-pane]')]
    this.backButton = this.node.querySelector('[data-act="back"]')
    this.activeTab = 'cultivation'
    this._focusTarget = null
    this._nativeDirectionHandled = false
    this.backButton.addEventListener('click', () => this.close())
    for (const tab of this.tabs) {
      tab.addEventListener('click', () => {
        this._setTab(tab.dataset.shopTab)
        this._focusElement(tab)
      })
      tab.addEventListener('keydown', (event) => this._moveTabFocus(event, tab))
    }

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
      row.tabIndex = -1
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
      row.tabIndex = -1
      row.addEventListener('click', () => this._unlock(u.kind, u.id))
      this.unlockGrid.appendChild(row)
      // `price` is the number, `costNode` the element — naming both `cost` had
      // the node shadow the value.
      return { kind: u.kind, id: u.id, price: u.cost, row, costNode: row.querySelector('.shop-cost') }
    })

    this._setTab(this.activeTab)
  }

  _setTab(tabId, focus = false) {
    if (!this.panes.some((pane) => pane.dataset.shopPane === tabId)) return
    this.activeTab = tabId
    for (const tab of this.tabs) {
      const selected = tab.dataset.shopTab === tabId
      tab.classList.toggle('active', selected)
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
      if (focus && selected) this._focusElement(tab)
    }
    for (const pane of this.panes) pane.hidden = pane.dataset.shopPane !== tabId
  }

  _activeRows() {
    const rows = this.activeTab === 'cultivation' ? this.rows : this.unlockRows
    return rows.filter((entry) => !entry.row.disabled && !entry.row.hidden)
  }

  _ownedFocus() {
    const active = globalThis.document?.activeElement
    return active && this.node.contains(active) ? active : this._focusTarget
  }

  _focusElement(element) {
    if (!element) return
    const cards = [...this.rows, ...this.unlockRows].map((entry) => entry.row)
    for (const tab of this.tabs) tab.classList.toggle('focused', tab === element)
    for (const card of cards) {
      card.classList.toggle('focused', card === element)
      card.tabIndex = card === element ? 0 : -1
    }
    this.backButton.classList.toggle('focused', this.backButton === element)
    this.backButton.tabIndex = this.backButton === element ? 0 : -1
    this._focusTarget = element
    element.focus?.({ preventScroll: true })
  }

  _focusTab(tabId = this.activeTab) {
    const tab = this.tabs.find((item) => item.dataset.shopTab === tabId) ?? this.tabs[0]
    this._focusElement(tab)
  }

  _focusRow(row) {
    if (row && !row.disabled) this._focusElement(row)
    else this._focusTab()
  }

  _activateFocused(element) {
    if (!element || element.disabled) return
    if (this.tabs.includes(element)) {
      this._setTab(element.dataset.shopTab, true)
      return
    }
    if (this.backButton === element) {
      this.close()
      return
    }
    element.click?.()
  }

  _moveFocus(dir, vertical = 0) {
    const active = this._ownedFocus()
    const tabIndex = this.tabs.indexOf(active)
    const rows = this._activeRows()
    const rowIndex = rows.findIndex((entry) => entry.row === active)
    const step = vertical || dir
    if (!step) return

    if (tabIndex >= 0) {
      if (vertical > 0) this._focusRow(rows[0]?.row ?? this.backButton)
      else if (vertical < 0) this._focusElement(this.backButton)
      else {
        const next = Math.max(0, Math.min(this.tabs.length - 1, tabIndex + dir))
        this._setTab(this.tabs[next].dataset.shopTab, true)
      }
      return
    }

    if (rowIndex >= 0) {
      const next = rowIndex + step
      if (next < 0) this._focusTab()
      else if (next >= rows.length) this._focusElement(this.backButton)
      else this._focusRow(rows[next].row)
      return
    }

    if (active === this.backButton) {
      if (step < 0) this._focusRow(rows.at(-1)?.row)
      else this._focusTab()
      return
    }

    this._focusTab()
  }

  _moveTabFocus(event, current) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    this._nativeDirectionHandled = true
    const index = this.tabs.indexOf(current)
    let next = index
    if (event.key === 'ArrowLeft') next = (index - 1 + this.tabs.length) % this.tabs.length
    if (event.key === 'ArrowRight') next = (index + 1) % this.tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = this.tabs.length - 1
    this._setTab(this.tabs[next].dataset.shopTab, true)
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  show(onClose) {
    this.onClose = onClose
    this.node.style.display = ''
    this.node.setAttribute('aria-hidden', 'false')
    this._setTab(this.activeTab)
    this.refresh()
    this._focusTab(this.activeTab)
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
      r.row.setAttribute('aria-label', `${r.up.name}. ${r.up.desc}. ${maxed ? '수련 완료' : `영석 ${cost}`}`)
      r.row.classList.toggle('maxed', maxed)
      r.row.classList.toggle('affordable', !maxed && this.progress.canAfford(r.up.id))
      r.row.disabled = maxed || !this.progress.canAfford(r.up.id)
    }

    for (const r of this.unlockRows) {
      const owned = this.progress.isUnlocked(r.kind, r.id)
      r.costNode.textContent = owned ? '보유' : String(r.price)
      r.row.setAttribute('aria-label', `${r.row.querySelector('.shop-name')?.textContent ?? r.id}. ${owned ? '이미 보유' : `해금 영석 ${r.price}`}`)
      r.row.classList.toggle('maxed', owned)
      r.row.classList.toggle('affordable', !owned && this.progress.canAffordUnlock(r.kind, r.id))
      r.row.disabled = owned || !this.progress.canAffordUnlock(r.kind, r.id)
    }

    const active = this._ownedFocus()
    if (active && active !== this.backButton && !this.tabs.includes(active) && active.disabled) {
      this._focusTab(this.activeTab)
    }
  }

  handleKey(confirm, dir = 0, vertical = 0) {
    if (!this.isOpen) return
    if (this._nativeDirectionHandled) {
      this._nativeDirectionHandled = false
      return
    }
    if (dir || vertical) {
      this._moveFocus(dir, vertical)
      return
    }
    if (confirm) this._activateFocused(this._ownedFocus())
  }

  close() {
    const cb = this.onClose
    this.hide()
    if (cb) cb()
  }

  /** Close without invoking the title callback while a run is taking ownership. */
  hide() {
    const active = this._ownedFocus()
    if (active) active.blur?.()
    this._focusTarget = null
    this.node.style.display = 'none'
    this.node.setAttribute('aria-hidden', 'true')
    this.onClose = null
  }

  dispose() {
    this.node.remove()
  }
}
