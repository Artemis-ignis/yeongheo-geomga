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
    this.node.className = 'screen'
    this.node.style.display = 'none'
    this.node.innerHTML = `
      <div class="screen-inner shop-inner">
        <div class="shop-head">
          <div class="shop-title">도감</div>
          <div class="shop-stones codex-progress"></div>
        </div>
        <div class="shop-scroll">
          <div class="shop-section">법보</div>
          <div class="codex-grid" data-kind="weapons"></div>
          <div class="shop-section">요괴</div>
          <div class="codex-grid" data-kind="enemies"></div>
          <div class="shop-section">마존</div>
          <div class="codex-grid" data-kind="bosses"></div>
          <div class="shop-section">업적</div>
          <div class="codex-achievements"></div>
          <div class="shop-section">기록</div>
          <div class="codex-records"></div>
        </div>
        <div class="codex-detail"></div>
        <button class="btn btn-alt clickable" data-act="back">← 돌아가기</button>
      </div>`
    root.appendChild(this.node)

    this.node.querySelector('[data-act="back"]').addEventListener('click', () => this.close())
    this.progressLabel = this.node.querySelector('.codex-progress')
    this.recordsHost = this.node.querySelector('.codex-records')
    this.achievementsHost = this.node.querySelector('.codex-achievements')

    this.detail = this.node.querySelector('.codex-detail')

    this.entries = [
      ...[...WEAPONS, ...EVOLUTIONS].map((w) => ({ kind: 'weapons', id: w.id, name: w.name, def: w })),
      ...ENEMIES.map((e) => ({ kind: 'enemies', id: e.id, name: e.name, def: e })),
      ...Object.values(BOSSES).map((b) => ({ kind: 'bosses', id: b.id, name: b.name, def: b })),
    ].map((entry) => {
      const host = this.node.querySelector(`.codex-grid[data-kind="${entry.kind}"]`)
      const cell = document.createElement('button')
      cell.className = 'codex-cell clickable'
      cell.innerHTML = `
        <img class="codex-icon" alt="" src="${iconFor(entry.id)}" />
        <div class="codex-name"></div>`
      cell.addEventListener('click', () => this.select(entry))
      cell.addEventListener('mouseenter', () => this.select(entry))
      host.appendChild(cell)
      return { ...entry, cell, nameNode: cell.querySelector('.codex-name') }
    })
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
    this.refresh()
    // Open on the first thing they have actually met, so the panel is never an
    // empty box on arrival.
    const first = this.entries.find((e) => this.progress.hasSeen(e.kind, e.id))
    if (first) this.select(first)
    else this.detail.innerHTML = '<div class="codex-detail-empty">한 번 싸워 보면 채워진다</div>'
  }

  refresh() {
    let seen = 0
    for (const e of this.entries) {
      const known = this.progress.hasSeen(e.kind, e.id)
      if (known) seen++
      e.cell.classList.toggle('unknown', !known)
      e.nameNode.textContent = known ? e.name : '???'
      e.cell.title = known ? e.name : '아직 만나지 못했다'
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
          <b>${a.name} <i>${a.hanja}</i></b>
          <span>${a.desc}</span>
          <em>${got ? '달성' : `+${a.stones}`}</em>
        </div>`
    }).join('')

    const r = this.progress.records
    const m = Math.floor(r.bestTime / 60)
    const s = Math.floor(r.bestTime % 60)
    this.recordsHost.innerHTML = `
      <div><span>도전 횟수</span><b>${r.runs}</b></div>
      <div><span>승천 횟수</span><b>${r.victories}</b></div>
      <div><span>최장 생존</span><b>${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</b></div>
      <div><span>최고 경지</span><b>${r.bestLevel}층</b></div>
      <div><span>누적 처치</span><b>${r.totalKills}</b></div>`
  }

  handleKey(confirm) {
    if (this.isOpen && confirm) this.close()
  }

  close() {
    const cb = this.onClose
    this.hide()
    if (cb) cb()
  }

  /** Close without invoking the title callback while a run is taking ownership. */
  hide() {
    this.node.style.display = 'none'
    this.onClose = null
  }

  dispose() {
    this.node.remove()
  }
}
