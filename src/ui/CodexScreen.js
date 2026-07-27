import { iconFor } from './icons.js'
import { ENEMIES } from '../data/enemies.js'
import { WEAPONS, EVOLUTIONS } from '../data/weapons.js'
import { BOSSES } from '../entities/BossManager.js'

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
          <div class="shop-section">기록</div>
          <div class="codex-records"></div>
        </div>
        <button class="btn btn-alt clickable" data-act="back">← 돌아가기</button>
      </div>`
    root.appendChild(this.node)

    this.node.querySelector('[data-act="back"]').addEventListener('click', () => this.close())
    this.progressLabel = this.node.querySelector('.codex-progress')
    this.recordsHost = this.node.querySelector('.codex-records')

    this.entries = [
      ...[...WEAPONS, ...EVOLUTIONS].map((w) => ({ kind: 'weapons', id: w.id, name: w.name })),
      ...ENEMIES.map((e) => ({ kind: 'enemies', id: e.id, name: e.name })),
      ...Object.values(BOSSES).map((b) => ({ kind: 'bosses', id: b.id, name: b.name })),
    ].map((entry) => {
      const host = this.node.querySelector(`.codex-grid[data-kind="${entry.kind}"]`)
      const cell = document.createElement('div')
      cell.className = 'codex-cell'
      cell.innerHTML = `
        <img class="codex-icon" alt="" src="${iconFor(entry.id)}" />
        <div class="codex-name"></div>`
      host.appendChild(cell)
      return { ...entry, cell, nameNode: cell.querySelector('.codex-name') }
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
    this.node.style.display = 'none'
    const cb = this.onClose
    this.onClose = null
    if (cb) cb()
  }

  dispose() {
    this.node.remove()
  }
}
