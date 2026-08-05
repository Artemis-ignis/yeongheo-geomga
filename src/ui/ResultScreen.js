import { iconFor } from './icons.js'

/** 승천 / 좌화 — the end-of-run summary. */
export class ResultScreen {
  constructor(root) {
    this.root = root
    this.onRestart = null

    this.node = document.createElement('div')
    this.node.className = 'screen'
    this.node.style.display = 'none'
    root.appendChild(this.node)
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  show(result, onRestart) {
    this.onRestart = onRestart
    const m = Math.floor(result.runTime / 60)
    const s = Math.floor(result.runTime % 60)
    const time = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

    const icons = [...result.weapons, ...result.passives]
      .map((it) => `<img alt="" title="${it.id}" src="${iconFor(it.id)}" />`)
      .join('')

    // 업적 earned by this run, if any. Shown between the numbers and the bank
    // because it is the one part of this screen that says what to try next
    // rather than what just happened.
    const earned = result.achievements ?? []
    const achievements = earned.length === 0 ? '' : `
      <div class="result-achievements">
        <div class="result-ach-title">업적 달성</div>
        ${earned.map((a) => `
          <div class="result-ach">
            <b>${a.name}</b><span>${a.desc}</span><em>+${a.stones}</em>
          </div>`).join('')}
      </div>`

    this.node.innerHTML = `
      <div class="screen-inner">
        <div class="result-banner ${result.victory ? 'win' : 'lose'}">
          ${result.victory ? '승천' : '좌화'}
        </div>
        <div class="result-flavor">
          ${result.victory
            ? '마존을 베고 비경의 마기를 걷어냈다. 그대는 승천한다.'
            : '기혈이 다해 그 자리에 앉은 채 숨을 거두었다.'}
        </div>
        <div class="result-stats">
          <div><span>생존 시간</span><b>${time}${result.bests?.time ? ' <em>신기록</em>' : ''}</b></div>
          <div><span>도달 경지</span><b>${result.realm.name} ${result.level}층${result.bests?.level ? ' <em>신기록</em>' : ''}</b></div>
          <div><span>처치 수</span><b>${result.kills}</b></div>
          <div><span>획득 영석</span><b class="gain">+${result.earnedStones ?? result.stones}</b></div>
        </div>
        ${achievements}
        <div class="result-bank">보유 영석 <b>${result.totalStones ?? 0}</b> · 단전에서 영구 강화에 쓸 수 있다</div>
        <div class="result-loadout">${icons}</div>
        <div class="result-seed">seed ${result.seed}</div>
        <button class="btn clickable">다시 도전</button>
      </div>`

    this.node.querySelector('.btn').addEventListener('click', () => this.restart())
    this.node.style.display = ''
  }

  restart() {
    const cb = this.onRestart
    this.hide()
    if (cb) cb()
  }

  handleKey(confirm) {
    if (this.isOpen && confirm) this.restart()
  }

  hide() {
    this.node.style.display = 'none'
  }

  dispose() {
    this.node.remove()
  }
}
