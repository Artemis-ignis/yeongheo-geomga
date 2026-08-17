import { iconFor } from './icons.js'
import { ENEMIES } from '../data/enemies.js'
import { WEAPONS, EVOLUTIONS } from '../data/weapons.js'
import { BOSSES } from '../data/bosses.js'
import { getPassive } from '../data/passives.js'
import { ACHIEVEMENTS } from '../data/achievements.js'

/** Element tags, as the game words them rather than as the code spells them. */
const TAG_NAMES = {
  sword: '검', fire: '화염', thunder: '뇌기', ice: '한빙', array: '진법',
}

/**
 * What a creature does, in a word. The behaviour ids are engineering terms and
 * a 도감 entry reading "lumberer" would be worse than saying nothing.
 */
const BEHAVIOUR_NAMES = {
  chase: '추적', dasher: '도약', ranged: '원거리', splitter: '분열',
  flanker: '측면', charger: '돌진', skirmisher: '치고 빠짐',
  drifter: '표류', flicker: '점멸', lumberer: '완보',
}

const passiveName = (id) => getPassive(id)?.name ?? id

/**
 * 도감 — what the player has actually encountered.
 *
 * Unseen entries stay as silhouettes with their name hidden, so the codex shows
 * how much is left to find without spoiling it.
 */
export class CodexScreen {
  constructor(root, progress) {
    this.progress = progress
    this.onClose = null

    this.node = document.createElement('div')
    this.node.className = 'screen codex-screen'
    this.node.setAttribute('role', 'dialog')
    this.node.setAttribute('aria-modal', 'true')
    this.node.setAttribute('aria-labelledby', 'codex-screen-title')
    this.node.setAttribute('aria-hidden', 'true')
    this.node.style.display = 'none'
    this.node.innerHTML = `
      <div class="screen-inner shop-inner">
        <div class="shop-head">
          <div class="shop-heading">
            <div class="shop-kicker">萬象 · 마주친 것의 이름</div>
            <div class="shop-title" id="codex-screen-title">도감</div>
            <p class="shop-lead">직접 맞선 요마와 깨달은 법보만 먹으로 새겨집니다.</p>
          </div>
          <div class="shop-stones codex-progress"></div>
        </div>
        <div class="collection-tabs codex-tabs" role="tablist" aria-label="도감 분류" aria-orientation="horizontal">
          <button class="collection-tab clickable" type="button" role="tab" id="codex-tab-weapons" data-codex-tab="weapons" aria-controls="codex-pane-weapons"><span aria-hidden="true">劍</span><b>법보</b></button>
          <button class="collection-tab clickable" type="button" role="tab" id="codex-tab-enemies" data-codex-tab="enemies" aria-controls="codex-pane-enemies"><span aria-hidden="true">妖</span><b>요괴</b></button>
          <button class="collection-tab clickable" type="button" role="tab" id="codex-tab-bosses" data-codex-tab="bosses" aria-controls="codex-pane-bosses"><span aria-hidden="true">魔</span><b>마존</b></button>
          <button class="collection-tab clickable" type="button" role="tab" id="codex-tab-achievements" data-codex-tab="achievements" aria-controls="codex-pane-achievements"><span aria-hidden="true">印</span><b>업적</b></button>
          <button class="collection-tab clickable" type="button" role="tab" id="codex-tab-records" data-codex-tab="records" aria-controls="codex-pane-records"><span aria-hidden="true">錄</span><b>기록</b></button>
        </div>
        <div class="shop-scroll codex-ledger">
          <section class="codex-pane" id="codex-pane-weapons" role="tabpanel" aria-labelledby="codex-tab-weapons" data-codex-pane="weapons"><div class="shop-section">깨달은 법보</div><div class="codex-grid" data-kind="weapons"></div></section>
          <section class="codex-pane" id="codex-pane-enemies" role="tabpanel" aria-labelledby="codex-tab-enemies" data-codex-pane="enemies"><div class="shop-section">마주친 요괴</div><div class="codex-grid" data-kind="enemies"></div></section>
          <section class="codex-pane" id="codex-pane-bosses" role="tabpanel" aria-labelledby="codex-tab-bosses" data-codex-pane="bosses"><div class="shop-section">격파한 마존</div><div class="codex-grid" data-kind="bosses"></div></section>
          <section class="codex-pane codex-pane-scroll" id="codex-pane-achievements" role="tabpanel" aria-labelledby="codex-tab-achievements" data-codex-pane="achievements"><div class="shop-section">천도 각인</div><div class="codex-achievements"></div></section>
          <section class="codex-pane" id="codex-pane-records" role="tabpanel" aria-labelledby="codex-tab-records" data-codex-pane="records"><div class="shop-section">수행 기록</div><div class="codex-records"></div></section>
        </div>
        <div class="codex-detail"></div>
        <button class="btn btn-alt btn-back clickable" data-act="back">검가로 돌아간다</button>
      </div>`
    root.appendChild(this.node)

    this.backButton = this.node.querySelector('[data-act="back"]')
    this.backButton.addEventListener('click', () => this.close())
    this.progressLabel = this.node.querySelector('.codex-progress')
    this.recordsHost = this.node.querySelector('.codex-records')
    this.achievementsHost = this.node.querySelector('.codex-achievements')
    this.detail = this.node.querySelector('.codex-detail')
    this.tabs = [...this.node.querySelectorAll('[data-codex-tab]')]
    this.panes = [...this.node.querySelectorAll('[data-codex-pane]')]
    this.activeTab = 'weapons'
    this._focusTarget = null
    this._nativeDirectionHandled = false
    for (const tab of this.tabs) {
      tab.addEventListener('click', () => {
        this._setTab(tab.dataset.codexTab)
        this._focusElement(tab)
      })
      tab.addEventListener('keydown', (event) => this._moveTabFocus(event, tab))
    }

    this.entries = [
      ...[...WEAPONS, ...EVOLUTIONS].map((w) => ({ kind: 'weapons', id: w.id, name: w.name, def: w })),
      ...ENEMIES.map((e) => ({ kind: 'enemies', id: e.id, name: e.name, def: e })),
      ...Object.values(BOSSES).map((b) => ({ kind: 'bosses', id: b.id, name: b.name, def: b })),
    ].map((entry) => {
      const host = this.node.querySelector(`.codex-grid[data-kind="${entry.kind}"]`)
      const cell = document.createElement('button')
      cell.className = 'codex-cell clickable'
      cell.tabIndex = -1
      cell.innerHTML = `
        <img class="codex-icon" alt="" src="${iconFor(entry.id)}" />
        <div class="codex-name"></div>`
      cell.addEventListener('click', () => this.select(entry))
      cell.addEventListener('mouseenter', () => this.select(entry))
      host.appendChild(cell)
      return { ...entry, cell, nameNode: cell.querySelector('.codex-name') }
    })

    this._setTab(this.activeTab)
  }

  _setTab(tabId, focus = false) {
    if (!this.panes.some((pane) => pane.dataset.codexPane === tabId)) return
    this.activeTab = tabId
    for (const tab of this.tabs) {
      const selected = tab.dataset.codexTab === tabId
      tab.classList.toggle('active', selected)
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
      if (focus && selected) this._focusElement(tab)
    }
    for (const pane of this.panes) pane.hidden = pane.dataset.codexPane !== tabId

    const entryPane = ['weapons', 'enemies', 'bosses'].includes(tabId)
    this.detail.hidden = !entryPane
    if (!entryPane) return
    const first = this.entries.find((entry) => entry.kind === tabId && this.progress.hasSeen(entry.kind, entry.id))
    if (first) this.select(first)
    else {
      for (const entry of this.entries) entry.cell.classList.remove('selected')
      this.detail.innerHTML = '<div class="codex-detail-empty">이 장은 아직 비어 있습니다</div>'
    }
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
    this._setTab(this.tabs[next].dataset.codexTab, true)
  }

  _activeEntries() {
    return this.entries.filter((entry) => entry.kind === this.activeTab && !entry.cell.disabled && !entry.cell.hidden)
  }

  _ownedFocus() {
    const active = globalThis.document?.activeElement
    return active && this.node.contains(active) ? active : this._focusTarget
  }

  _focusElement(element) {
    if (!element) return
    for (const tab of this.tabs) tab.classList.toggle('focused', tab === element)
    for (const entry of this.entries) {
      entry.cell.classList.toggle('focused', entry.cell === element)
      entry.cell.tabIndex = entry.cell === element ? 0 : -1
    }
    this.backButton.classList.toggle('focused', this.backButton === element)
    this.backButton.tabIndex = this.backButton === element ? 0 : -1
    this._focusTarget = element
    element.focus?.({ preventScroll: true })
  }

  _focusTab(tabId = this.activeTab) {
    const tab = this.tabs.find((item) => item.dataset.codexTab === tabId) ?? this.tabs[0]
    this._focusElement(tab)
  }

  _focusEntry(entry) {
    if (entry) this._focusElement(entry.cell)
    else this._focusTab()
  }

  _activateFocused(element) {
    if (!element || element.disabled) return
    const tab = this.tabs.find((item) => item === element)
    if (tab) {
      this._setTab(tab.dataset.codexTab, true)
      return
    }
    const entry = this.entries.find((item) => item.cell === element)
    if (entry) {
      this.select(entry)
      this._focusEntry(entry)
      return
    }
    if (this.backButton === element) this.close()
  }

  _moveFocus(dir, vertical = 0) {
    const active = this._ownedFocus()
    const tabIndex = this.tabs.indexOf(active)
    const entries = this._activeEntries()
    const entryIndex = entries.findIndex((entry) => entry.cell === active)
    const step = vertical || dir
    if (!step) return

    if (tabIndex >= 0) {
      if (vertical > 0) this._focusEntry(entries[0])
      else if (vertical < 0) this._focusElement(this.backButton)
      else {
        const next = Math.max(0, Math.min(this.tabs.length - 1, tabIndex + dir))
        this._setTab(this.tabs[next].dataset.codexTab, true)
      }
      return
    }

    if (entryIndex >= 0) {
      const next = entryIndex + step
      if (next < 0) this._focusTab()
      else if (next >= entries.length) this._focusElement(this.backButton)
      else this._focusEntry(entries[next])
      return
    }

    if (active === this.backButton) {
      if (step < 0) this._focusEntry(entries.at(-1))
      else this._focusTab()
      return
    }

    this._focusTab()
  }

  /**
   * Show what an entry actually is.
   *
   * The codex was a checklist: thirty-five icons, colour if you had met the
   * thing and a silhouette if you had not, and nothing anywhere said what any of
   * them did. A player who wanted to know whether 부적귀 shoots or charges, or
   * what 만검귀종 is an evolution of, had no way to find out inside the game.
   * Collecting is only half of what a 도감 is for.
   *
   * Unseen entries stay unreadable — the point of the silhouettes is that the
   * roster is something to discover, and a description would give that away.
   */
  select(entry) {
    for (const e of this.entries) e.cell.classList.toggle('selected', e === entry)
    if (!this.progress.hasSeen(entry.kind, entry.id)) {
      this.detail.innerHTML = '<div class="codex-detail-empty">아직 만나지 못했다</div>'
      return
    }
    const d = entry.def ?? {}
    const facts = []
    if (entry.kind === 'weapons') {
      const evolvesFrom = [...WEAPONS].find((w) => w.evolvesTo === entry.id)
      if (d.tag) facts.push(['속성', TAG_NAMES[d.tag] ?? d.tag])
      if (d.levels) facts.push(['최대 단계', `${d.levels.length}`])
      if (d.evolvesTo && d.pairPassive) {
        facts.push(['진화 조건', `극에 달한 뒤 ${passiveName(d.pairPassive)}`])
      }
      if (evolvesFrom) facts.push(['본래', evolvesFrom.name])
    } else {
      if (Number.isFinite(d.hp)) facts.push(['기혈', `${d.hp}`])
      if (Number.isFinite(d.damage)) facts.push(['접촉 피해', `${d.damage}`])
      if (Number.isFinite(d.speed)) facts.push(['속도', d.speed.toFixed(1)])
      if (Number.isFinite(d.xp)) facts.push(['영기', `${d.xp}`])
      if (d.elite) facts.push(['격', '정예'])
      if (d.shotDamage) facts.push(['원거리', `${d.shotDamage}`])
      if (d.behavior) facts.push(['거동', BEHAVIOUR_NAMES[d.behavior] ?? d.behavior])
    }

    this.detail.innerHTML = `
      <img class="codex-detail-icon" alt="" src="${iconFor(entry.id)}" />
      <div class="codex-detail-body">
        <div class="codex-detail-name">${entry.name}</div>
        <div class="codex-detail-desc">${d.desc ?? ''}</div>
        <div class="codex-detail-facts">
          ${facts.map(([k, v]) => `<span><i>${k}</i> ${v}</span>`).join('')}
        </div>
      </div>`
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  show(onClose) {
    this.onClose = onClose
    this.node.style.display = ''
    this.node.setAttribute('aria-hidden', 'false')
    this.refresh()
    this._setTab(this.activeTab)
    this._focusTab(this.activeTab)
  }

  refresh() {
    let seen = 0
    for (const e of this.entries) {
      const known = this.progress.hasSeen(e.kind, e.id)
      if (known) seen++
      e.cell.classList.toggle('unknown', !known)
      e.nameNode.textContent = known ? e.name : '미발견'
      e.cell.title = known ? e.name : '아직 만나지 못했다'
      e.cell.setAttribute('aria-label', known ? `${e.name}. 도감 항목` : '미발견. 아직 만나지 못했다')
    }
    this.progressLabel.textContent = `${seen} / ${this.entries.length}`

    // Every 업적 is listed whether earned or not, with its condition legible.
    // A hidden goal is not a goal — the point of this list is to tell the
    // player what the game wants from them next, and a row of question marks
    // does the opposite.
    const done = this.progress.achievements
    this.achievementsHost.innerHTML = ACHIEVEMENTS.map((a) => {
      const got = done.includes(a.id)
      return `
        <div class="codex-ach${got ? ' earned' : ''}">
          <b>${a.name}</b>
          <span>${a.desc}</span>
          <em>${got ? '달성' : `+${a.stones}`}</em>
        </div>`
    }).join('')

    const r = this.progress.records
    const journey = this.progress.state.journey ?? {}
    const decisionCount = Object.values(journey.decisions ?? {})
      .reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0)
    this.recordsHost.innerHTML = `
      <div><span>전체 출정</span><b>${r.runs ?? 0}</b></div>
      <div><span>본편 완수</span><b>${journey.expeditionVictories ?? 0}</b></div>
      <div><span>남긴 결단</span><b>${decisionCount}</b></div>
      <div><span>천겁 완수</span><b>${journey.survivalVictories ?? 0}</b></div>
      <div><span>최고 경지</span><b>${r.bestLevel ?? 1}층</b></div>
      <div><span>누적 처치</span><b>${r.totalKills ?? 0}</b></div>`
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
