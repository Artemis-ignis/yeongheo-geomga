import { iconFor } from './icons.js'
import { MAX_WEAPON_SLOTS, MAX_PASSIVE_SLOTS } from '../combat/upgrades.js'
import { getWeapon } from '../data/weapons.js'
import { getPassive } from '../data/passives.js'

const HP_GHOST_LAG = 2.4
export const RADAR_POI_STYLE = Object.freeze({
  altar: Object.freeze({ color: '#f2c76f', glyph: '수' }),
  treasure: Object.freeze({ color: '#8edcff', glyph: '보' }),
  elite_seal: Object.freeze({ color: '#ef79aa', glyph: '봉' }),
  healing_spring: Object.freeze({ color: '#73e3bd', glyph: '회' }),
})

export function radarPointPosition(point, radius) {
  const x = Number.isFinite(point?.x) ? Math.max(-1, Math.min(1, point.x)) : 0
  const z = Number.isFinite(point?.z) ? Math.max(-1, Math.min(1, point.z)) : 0
  // World +Z is the player's forward direction at heading 0, which is the top
  // of the radar. Keeping that convention makes the heading marker useful.
  return { x: x * radius, y: -z * radius }
}

/**
 * Keep the integer HUD readout truthful when authored multipliers produce a
 * fractional maximum.  Rounding current HP up but maximum HP to nearest used
 * to show impossible values such as `153 / 152` at full health.
 */
export function formatHpReadout(hp, maxHp) {
  const safeMax = Number.isFinite(maxHp) ? Math.max(0, maxHp) : 0
  const safeHp = Number.isFinite(hp) ? Math.max(0, Math.min(hp, safeMax)) : 0
  const displayMax = Math.ceil(safeMax)
  const displayHp = Math.min(displayMax, Math.ceil(safeHp))
  return `${displayHp} / ${displayMax}`
}

function el(tag, cls, parent) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (parent) parent.appendChild(node)
  return node
}

function assetUrl(file) {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base}assets/${file}`
}

function optionalUiText(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'object') {
    return value.label ?? value.name ?? value.text ?? value.description ?? value.objective ?? value.id ?? ''
  }
  return String(value)
}

function formatDaoGauge(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'object') {
    const label = value.label ?? value.name ?? '도 진행'
    const current = value.current ?? value.value ?? value.progress ?? value.milestone ?? value.gauge
    const max = value.max ?? value.total ?? value.goal ?? value.gaugeMax
    if (Number.isFinite(current) && Number.isFinite(max)) return `${label} ${current}/${max}`
    if (Number.isFinite(current)) return `${label} ${current}`
    return optionalUiText(value)
  }
  return Number.isFinite(value) ? `도 진행 ${value}` : String(value)
}

/**
 * The Dao model owns the authored palette and VFX ids.  UI surfaces only need
 * a small, stable visual contract, with a neutral fallback for old saves or
 * an unselected run.  Keeping this normalizer here means the HUD, pledge
 * cards, and result summary cannot quietly invent three different identities.
 */
const DAO_VOW_UI = Object.freeze({
  sword: Object.freeze({
    glyph: '검', name: '검맥', hanja: '劍脈',
    palette: Object.freeze({ primary: 0xeaf6ff, secondary: 0x6f9fda, accent: 0xffffff, boss: 0x8abfff }),
    vfx: Object.freeze({ select: 'dao-sword', pledge: 'sword-fan' }),
  }),
  frost: Object.freeze({
    glyph: '설', name: '설맥', hanja: '雪脈',
    palette: Object.freeze({ primary: 0xb8efff, secondary: 0xeffbff, accent: 0x73cfff, boss: 0x9ee8ff }),
    vfx: Object.freeze({ select: 'dao-frost', pledge: 'frost-field' }),
  }),
  spirit: Object.freeze({
    glyph: '심', name: '심맥', hanja: '心脈',
    palette: Object.freeze({ primary: 0x9d71e8, secondary: 0xffd66b, accent: 0xf3b8ff, boss: 0xc98cff }),
    vfx: Object.freeze({ select: 'dao-spirit', pledge: 'spirit-overcharge' }),
  }),
})

const DAO_VFX_LABELS = Object.freeze({
  'dao-sword': '검맥의 결',
  'sword-fan': '검비',
  'returning-sword-line': '회귀검선',
  'piercing-sword-line': '관통검선',
  'closing-sword-ring': '검환',
  'dao-frost': '설맥의 결',
  'frost-field': '빙결진',
  'frost-shards': '냉기 파편',
  'frost-line': '절단 빙선',
  'ice-wall': '빙벽',
  'dao-spirit': '심맥의 결',
  'spirit-overcharge': '심맥 과충전',
  'spirit-purge': '심화정화',
  'echoing-heart': '심마 공명',
  'shadow-copy': '그림자 분신',
})

const DAO_EMPTY_VISUAL = Object.freeze({
  identity: 'dao-unselected', vowId: null, name: null, hanja: null, glyph: '도',
  palette: null, css: Object.freeze({
    primary: '#d8e2ec', secondary: '#708092', accent: '#e8c56a', boss: '#9aaabd',
  }), vfx: null, activeVfx: null, activeVfxLabel: '', milestone: 0,
})

function cssHex(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `#${Math.max(0, Math.min(0xffffff, Math.round(value))).toString(16).padStart(6, '0')}`
  }
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

/** Normalize a Dao snapshot, presentation object, or card presentation. */
export function getDaoVowVisual(value = null) {
  const nested = value?.presentation && typeof value.presentation === 'object'
    ? value.presentation
    : value
  let vowId = nested?.vowId ?? value?.vowId
    ?? (DAO_VOW_UI[nested?.id] ? nested.id : null)
  if (!vowId) {
    vowId = Object.entries(DAO_VOW_UI)
      .find(([, visual]) => visual.name === nested?.name || visual.hanja === nested?.hanja)?.[0] ?? null
  }
  const authored = DAO_VOW_UI[vowId]
  if (!authored) return DAO_EMPTY_VISUAL

  const palette = nested?.palette ?? nested?.colors ?? value?.palette ?? authored.palette
  const vfx = nested?.vfx ?? value?.vfx ?? authored.vfx
  const activeVfx = nested?.activeVfx
    ?? value?.activeVfx
    ?? (typeof vfx === 'object' ? vfx.pledge ?? vfx.select : vfx)
    ?? authored.vfx.pledge
  const milestone = Number.isFinite(nested?.milestone)
    ? nested.milestone
    : Number.isFinite(value?.milestone) ? value.milestone : 0
  const name = nested?.name ?? value?.vowName ?? authored.name
  const hanja = nested?.hanja ?? value?.vowHanja ?? authored.hanja
  return {
    identity: nested?.identity ?? `dao-${vowId}`,
    vowId,
    name,
    hanja,
    glyph: nested?.glyph ?? value?.glyph ?? authored.glyph,
    palette,
    css: {
      primary: cssHex(palette?.primary, cssHex(authored.palette.primary, '#d8e2ec')),
      secondary: cssHex(palette?.secondary, cssHex(authored.palette.secondary, '#708092')),
      accent: cssHex(palette?.accent, cssHex(authored.palette.accent, '#e8c56a')),
      boss: cssHex(palette?.boss, cssHex(authored.palette.boss, '#9aaabd')),
    },
    vfx,
    activeVfx,
    activeVfxLabel: DAO_VFX_LABELS[activeVfx] ?? activeVfx ?? '',
    milestone,
  }
}

/** Apply the visual contract to a DOM surface without assuming CSSOM support. */
export function applyDaoVowCssVars(node, visual) {
  if (!node?.style || !visual?.css) return
  for (const [key, value] of Object.entries(visual.css)) {
    const property = `--dao-${key}`
    if (typeof node.style.setProperty === 'function') node.style.setProperty(property, value)
    else node.style[property] = value
  }
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
    // Last written value per field, so update() can skip unchanged DOM writes.
    this._last = {}

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
    this.kills.setAttribute('aria-label', '처치 수')
    this.stones.setAttribute('aria-label', '런 영석')
    this.dao = el('div', 'hud-dao', left)
    this.dao.setAttribute('role', 'status')
    this.dao.setAttribute('aria-live', 'polite')
    this.daoGlyph = el('span', 'hud-dao-glyph', this.dao)
    this.daoGlyph.setAttribute('aria-hidden', 'true')
    this.daoLabel = el('span', 'hud-dao-label', this.dao)
    this.daoProgress = el('span', 'hud-dao-progress', this.dao)
    this.daoVfx = el('span', 'hud-dao-vfx', this.dao)
    this.dao.style.display = 'none'
    this.dao.hidden = true
    this.daoGauge = el('div', 'hud-dao-gauge', left)
    this.daoGauge.hidden = true
    this.daoGauge.style.display = 'none'

    // Top right: a small tactical radar. It is intentionally canvas-native so
    // the horde never becomes dozens of DOM nodes during a late run.
    const radar = el('div', 'hud-radar', this.node)
    this.radarCanvas = el('canvas', 'hud-radar-canvas', radar)
    this.radarCanvas.width = 176
    this.radarCanvas.height = 176
    this.radarCtx = this.radarCanvas.getContext('2d')
    this.radarCanvas.setAttribute('role', 'img')
    this.radarCanvas.setAttribute('aria-label', '영맥 감지 레이더. 중앙은 현재 위치이며 위쪽은 진행 방향입니다.')
    this.radarLabel = el('div', 'hud-radar-label', radar)
    this.radarLabel.textContent = '영맥 감지'
    this.objective = el('div', 'hud-objective', this.node)
    this.objective.setAttribute('role', 'status')
    this.objective.setAttribute('aria-live', 'polite')
    this.objectiveText = el('span', 'hud-objective-text', this.objective)
    this.objective.hidden = true
    this.objective.style.display = 'none'
    this._radarAt = -Infinity
    this._radarRunKey = null
    this._radarRevision = null

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
    this.bossPortrait = el('img', 'hud-boss-portrait', this.bossWrap)
    this.bossPortrait.setAttribute('alt', '보스 초상화')
    this.bossPortrait.style.display = 'none'
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
    row.setAttribute('role', 'list')
    row.setAttribute('aria-label', kind === 'weapon' ? '보유 법보' : '수련 공법')
    const slots = []
    for (let i = 0; i < count; i++) {
      const slot = el('div', `hud-slot kind-${kind}`, row)
      slot.dataset.kind = kind
      slot.setAttribute('role', 'listitem')
      slot.setAttribute('tabindex', '-1')
      slot.setAttribute('aria-label', `빈 ${kind === 'weapon' ? '법보' : '공법'} 슬롯 ${i + 1}`)
      const img = el('img', 'hud-slot-icon', slot)
      img.setAttribute('alt', '')
      img.setAttribute('draggable', 'false')
      img.setAttribute('decoding', 'async')
      const kindNode = el('span', 'hud-slot-kind', slot)
      kindNode.setAttribute('aria-hidden', 'true')
      const nameNode = el('span', 'hud-slot-name', slot)
      nameNode.setAttribute('aria-hidden', 'true')
      const levelNode = el('span', 'hud-slot-level', slot)
      levelNode.setAttribute('aria-hidden', 'true')
      const pips = el('div', 'hud-pips', slot)
      pips.setAttribute('aria-hidden', 'true')
      const pipNodes = []
      for (let p = 0; p < 5; p++) pipNodes.push(el('i', null, pips))
      slots.push({
        slot, img, kindNode, nameNode, levelNode, pipNodes,
        slotKind: kind, visualKind: kind, id: null, level: 0, metaKey: null,
      })
    }
    return slots
  }

  _itemPresentation(item, slotKind) {
    const definition = slotKind === 'passive' ? getPassive(item.id) : getWeapon(item.id)
    const visualKind = slotKind === 'passive'
      ? 'passive'
      : definition?.evolutionOf ? 'evolution' : 'weapon'
    const kindLabel = visualKind === 'passive' ? '공법' : visualKind === 'evolution' ? '진화 법보' : '법보'
    const kindMark = visualKind === 'passive' ? '공' : visualKind === 'evolution' ? '진' : '법'
    const name = item.name ?? definition?.name ?? item.id
    const effect = item.desc ?? definition?.desc ?? ''
    const maxLevel = slotKind === 'passive' ? definition?.max : definition?.levels?.length
    const level = Math.max(0, Number.isFinite(item.level) ? item.level : 0)
    const levelText = visualKind === 'evolution'
      ? '진화'
      : Number.isFinite(maxLevel) ? `Lv.${level}/${maxLevel}` : `Lv.${level}`
    return { visualKind, kindLabel, kindMark, name, effect, level, levelText }
  }

  _syncRow(slots, items) {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      const item = items[i]
      if (!item) {
        if (s.id !== null) {
          s.id = null
          s.level = 0
          s.metaKey = null
          s.slot.classList.remove('filled')
          s.slot.classList.add('empty')
          s.slot.classList.remove('kind-weapon', 'kind-passive', 'kind-evolution')
          s.slot.classList.add(`kind-${s.slotKind}`)
          s.slot.dataset.kind = s.slotKind
          s.slot.setAttribute('tabindex', '-1')
          s.slot.setAttribute('aria-label', `빈 ${s.slotKind === 'weapon' ? '법보' : '공법'} 슬롯 ${i + 1}`)
          s.slot.removeAttribute('title')
          s.img.removeAttribute('src')
          s.img.setAttribute('alt', '')
          s.img.removeAttribute('title')
          s.kindNode.textContent = ''
          s.nameNode.textContent = ''
          s.levelNode.textContent = ''
          for (const p of s.pipNodes) p.classList.remove('on')
        }
        continue
      }
      const presentation = this._itemPresentation(item, s.slotKind)
      if (s.id !== item.id) {
        s.id = item.id
        s.metaKey = null
        s.img.setAttribute('src', iconFor(item.id))
        s.slot.classList.add('filled')
        s.slot.classList.remove('empty')
        s.slot.setAttribute('tabindex', '0')
        s.level = 0
      }
      const metaKey = [
        presentation.visualKind, presentation.name, presentation.effect,
        presentation.level, presentation.levelText,
      ].join('|')
      if (s.metaKey !== metaKey) {
        s.metaKey = metaKey
        s.slot.classList.remove('kind-weapon', 'kind-passive', 'kind-evolution')
        s.slot.classList.add(`kind-${presentation.visualKind}`)
        s.slot.dataset.kind = presentation.visualKind
        s.kindNode.textContent = presentation.kindMark
        s.nameNode.textContent = presentation.name
        s.levelNode.textContent = presentation.levelText
        const details = presentation.effect
          ? `${presentation.kindLabel} · ${presentation.name} · ${presentation.levelText}\n${presentation.effect}`
          : `${presentation.kindLabel} · ${presentation.name} · ${presentation.levelText}`
        s.slot.setAttribute('aria-label', details.replace('\n', '. 효과: '))
        s.slot.setAttribute('title', details)
        s.img.setAttribute('alt', `${presentation.name} ${presentation.kindLabel} 아이콘`)
        s.img.setAttribute('title', `${presentation.kindLabel} · ${presentation.name}`)
      }
      if (s.level !== presentation.level) {
        s.level = presentation.level
        for (let p = 0; p < s.pipNodes.length; p++) {
          s.pipNodes[p].classList.toggle('on', p < presentation.level)
        }
        // Restart the flash animation on change.
        s.slot.classList.remove('flash')
        void s.slot.offsetWidth
        s.slot.classList.add('flash')
      }
    }
  }

  /**
   * Write only when the rendered value actually changed.
   *
   * Every `textContent` and `style.width` assignment invalidates style and
   * layout. Doing ~15 of them unconditionally each frame was costing real time
   * for text that changes about once a second.
   */
  _set(node, prop, value) {
    if (this._last[prop] === value) return
    this._last[prop] = value
    if (prop.endsWith('Width')) node.style.width = value
    else node.textContent = value
  }

  update(state, dt = 1 / 60) {
    this._set(this.realm, 'realm', `${state.realm.name} · ${state.level}층`)

    const m = Math.floor(state.runTime / 60)
    const s = Math.floor(state.runTime % 60)
    this._set(this.timer, 'timer', `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)

    // Quantised to 0.5% — finer than a pixel on any realistic bar width.
    const xpPct = Math.min(100, (state.xp / Math.max(1, state.xpNeeded)) * 100)
    this._set(this.xpFill, 'xpWidth', `${(Math.round(xpPct * 2) / 2)}%`)

    this._set(this.kills, 'kills', `처치 ${state.kills}`)
    this._set(this.stones, 'stones', `영석 ${state.stones}`)
    const daoVisual = getDaoVowVisual(state.daoVow)
    const hasDao = Boolean(daoVisual.vowId && daoVisual.name)
    const daoText = hasDao
      ? `${daoVisual.name} · ${daoVisual.milestone}/3`
      : ''
    const daoKey = hasDao
      ? `${daoVisual.identity}|${daoVisual.milestone}|${daoVisual.activeVfx ?? ''}`
      : 'dao-unselected'
    if (this._last.daoKey !== daoKey) {
      this._last.daoKey = daoKey
      this.dao.hidden = !hasDao
      this.dao.style.display = hasDao ? '' : 'none'
      this.daoGlyph.textContent = hasDao ? daoVisual.glyph : ''
      this.daoLabel.textContent = hasDao ? daoVisual.name : ''
      this.daoProgress.textContent = hasDao ? `${daoVisual.milestone}/3` : ''
      this.daoVfx.textContent = hasDao ? daoVisual.activeVfxLabel : ''
      this.dao.dataset.daoIdentity = hasDao ? daoVisual.identity : 'dao-unselected'
      this.dao.dataset.daoVfx = hasDao ? (daoVisual.activeVfx ?? '') : ''
      this.dao.setAttribute('aria-label', hasDao
        ? `맹세 ${daoText}; 현재 발현 ${daoVisual.activeVfxLabel || '없음'}`
        : '맹세 미선택')
      if (hasDao) applyDaoVowCssVars(this.dao, daoVisual)
    }

    // Newer runtime snapshots can provide an explicit goal or Dao gauge. Old
    // snapshots do not, so these remain completely absent from the HUD unless
    // the producer supplies a value.
    const objectiveValue = optionalUiText(
      state.objective ?? state.objectiveText ?? state.nextObjective ?? state.firstVowObjective,
    )
    if (this._last.objectiveValue !== objectiveValue) {
      this._last.objectiveValue = objectiveValue
      this.objective.hidden = !objectiveValue
      this.objective.style.display = objectiveValue ? '' : 'none'
      this.objectiveText.textContent = objectiveValue
      this.objective.setAttribute('aria-label', objectiveValue ? `현재 목표: ${objectiveValue}` : '현재 목표 없음')
    }
    const daoGaugeValue = formatDaoGauge(
      state.daoGauge ?? state.daoRuntime ?? state.dao?.gauge ?? null,
    )
    if (this._last.daoGaugeValue !== daoGaugeValue) {
      this._last.daoGaugeValue = daoGaugeValue
      this.daoGauge.hidden = !daoGaugeValue
      this.daoGauge.style.display = daoGaugeValue ? '' : 'none'
      this.daoGauge.textContent = daoGaugeValue
      this.daoGauge.setAttribute('aria-label', daoGaugeValue || '도 진행 정보 없음')
    }

    if (state.runId !== undefined && state.runId !== this._radarRunKey) {
      this._radarRunKey = state.runId
      this._radarAt = -Infinity
    }
    if (state.radarRevision !== undefined && state.radarRevision !== this._radarRevision) {
      this._radarRevision = state.radarRevision
      this._radarAt = -Infinity
    }
    const radarTime = Number.isFinite(state.runTime) ? state.runTime : 0
    if (state.radar && (
      radarTime < this._radarAt
      || radarTime - this._radarAt >= 0.08
    )) {
      this._radarAt = radarTime
      this._drawRadar(state.radar, state.playerHeading ?? 0)
    }

    const hpRatio = Math.max(0, state.hp / Math.max(1, state.maxHp))
    this._set(this.hpFill, 'hpWidth', `${(Math.round(hpRatio * 200) / 2)}%`)
    // The bar carried no information: it was the same red gradient at 100/100 as
    // at 8/100, so the only way to know whether you were hurt was to read the
    // number — during a fight, in the corner of the eye, which is exactly when
    // nobody reads a number. The hue does the telling now, and it stays in the
    // 기혈 family rather than going traffic-light green: full is a warm bright
    // vermilion, and it deepens toward a dark crimson as it drains. Quantised to
    // twentieths so this writes a style property a few times a run, not sixty
    // times a second.
    const band = Math.round(hpRatio * 20)
    if (this._last.hpBand !== band) {
      this._last.hpBand = band
      const k = band / 20
      // 0 -> #6d1a1e, 1 -> #ff8a72
      const lerp = (a, b) => Math.round(a + (b - a) * k)
      const top = `rgb(${lerp(0x8e, 0xff)},${lerp(0x27, 0x8a)},${lerp(0x24, 0x72)})`
      const bottom = `rgb(${lerp(0x4a, 0xc4)},${lerp(0x12, 0x3a)},${lerp(0x14, 0x33)})`
      this.hpFill.style.setProperty('--hp-top', top)
      this.hpFill.style.setProperty('--hp-bottom', bottom)
      this.hpFill.classList.toggle('low', k <= 0.25)
    }
    // The ghost lags behind so the player can see how much was just lost.
    this.ghostHp += (hpRatio - this.ghostHp) * Math.min(1, HP_GHOST_LAG * dt)
    if (this.ghostHp < hpRatio) this.ghostHp = hpRatio
    this._set(this.hpGhost, 'ghostWidth', `${(Math.round(this.ghostHp * 200) / 2)}%`)
    this._set(this.hpText, 'hpText', formatHpReadout(state.hp, state.maxHp))

    const ready = state.dashCooldown <= 0
    if (this._last.dashReady !== ready) {
      this._last.dashReady = ready
      this.dashPip.classList.toggle('ready', ready)
    }
    const dashPct = Math.round(ready ? 100 : (1 - state.dashCooldown / 3) * 100)
    if (this._last.dashPct !== dashPct) {
      this._last.dashPct = dashPct
      this.dashPip.style.setProperty('--fill', `${dashPct}%`)
    }

    this._syncRow(this.weaponSlots, state.weapons)
    this._syncRow(this.passiveSlots, state.passives)

    if (state.boss) {
      if (!this._last.bossShown) {
        this._last.bossShown = true
        this.bossWrap.style.display = ''
      }
      this._set(this.bossName, 'bossName', state.boss.name)
      const bossPortraitAlt = `${state.boss.name || '보스'} 초상화`
      if (this._last.bossPortraitAlt !== bossPortraitAlt) {
        this._last.bossPortraitAlt = bossPortraitAlt
        this.bossPortrait.setAttribute('alt', bossPortraitAlt)
        this.bossPortrait.setAttribute('title', bossPortraitAlt)
      }
      const pct = Math.max(0, Math.round((state.boss.hp / state.boss.maxHp) * 200) / 2)
      this._set(this.bossFill, 'bossWidth', `${pct}%`)
      const referenceAsset = state.boss.referenceAsset ?? ''
      if (this._last.bossPortrait !== referenceAsset) {
        this._last.bossPortrait = referenceAsset
        if (referenceAsset) {
          this.bossPortrait.src = assetUrl(referenceAsset)
          this.bossPortrait.style.display = ''
        } else {
          this.bossPortrait.removeAttribute('src')
          this.bossPortrait.style.display = 'none'
        }
      }
    } else if (this._last.bossShown) {
      this._last.bossShown = false
      this.bossWrap.style.display = 'none'
      this._last.bossPortrait = ''
      this._last.bossPortraitAlt = ''
      this.bossPortrait.removeAttribute('src')
      this.bossPortrait.setAttribute('alt', '보스 초상화')
      this.bossPortrait.removeAttribute('title')
      this.bossPortrait.style.display = 'none'
    }
  }

  show() { this.node.style.display = '' }
  hide() { this.node.style.display = 'none' }

  reset() {
    this.ghostHp = 1
    this._last = {}
    this._radarAt = -Infinity
    this._radarRunKey = null
    this._radarRevision = null
    this.dao.hidden = true
    this.dao.style.display = 'none'
    this.daoGlyph.textContent = ''
    this.daoLabel.textContent = ''
    this.daoProgress.textContent = ''
    this.daoVfx.textContent = ''
    this.dao.dataset.daoIdentity = 'dao-unselected'
    this.dao.dataset.daoVfx = ''
    this.dao.setAttribute('aria-label', '맹세 미선택')
    this.daoGauge.hidden = true
    this.daoGauge.style.display = 'none'
    this.daoGauge.textContent = ''
    this.daoGauge.setAttribute('aria-label', '도 진행 정보 없음')
    this.objective.hidden = true
    this.objective.style.display = 'none'
    this.objectiveText.textContent = ''
    this.objective.setAttribute('aria-label', '현재 목표 없음')
    // reset() clears the cache, so update(null-boss) cannot infer that an old
    // boss bar is still visible. Hide and clear it here before the next run.
    this.bossWrap.style.display = 'none'
    this.bossName.textContent = ''
    this.bossFill.style.width = '0%'
    this.bossPortrait.removeAttribute('src')
    this.bossPortrait.setAttribute('alt', '보스 초상화')
    this.bossPortrait.removeAttribute('title')
    this.bossPortrait.style.display = 'none'
    this._drawRadar([], 0)
  }

  _drawRadar(points, heading) {
    const ctx = this.radarCtx
    if (!ctx) return
    const w = this.radarCanvas.width
    const h = this.radarCanvas.height
    const cx = w * 0.5
    const cy = h * 0.5
    const r = w * 0.38
    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = 'rgba(5, 13, 17, 0.58)'
    ctx.beginPath()
    ctx.arc(cx, cy, r + 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(127, 214, 181, 0.42)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(127, 214, 181, 0.14)'
    ctx.lineWidth = 1
    for (const ring of [0.5, 0.75]) {
      ctx.beginPath()
      ctx.arc(cx, cy, r * ring, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(cx - r, cy)
    ctx.lineTo(cx + r, cy)
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx, cy + r)
    ctx.stroke()

    for (const point of points ?? []) {
      const offset = radarPointPosition(point, r)
      const px = cx + offset.x
      const py = cy + offset.y
      if (point.poi) {
        const style = RADAR_POI_STYLE[point.poiType] ?? RADAR_POI_STYLE.altar
        const size = point.nearby ? 8 : 6.5
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(Math.PI / 4)
        ctx.fillStyle = 'rgba(4, 12, 16, 0.88)'
        ctx.strokeStyle = style.color
        ctx.lineWidth = point.nearby ? 2.8 : 2.2
        ctx.beginPath()
        ctx.moveTo(0, -size)
        ctx.lineTo(size, 0)
        ctx.lineTo(0, size)
        ctx.lineTo(-size, 0)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.rotate(-Math.PI / 4)
        ctx.beginPath()
        ctx.arc(0, 0, size + (point.nearby ? 5 : 3.5), 0, Math.PI * 2)
        ctx.strokeStyle = style.color
        ctx.globalAlpha = point.nearby ? 0.95 : 0.72
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.fillStyle = style.color
        ctx.font = '900 11px Malgun Gothic, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(style.glyph, 0, 0.5)
        ctx.restore()
        continue
      }
      const size = point.elite ? 4.2 : 2.4
      ctx.fillStyle = point.elite
        ? '#f0cf76'
        : point.ranged ? '#ff967c' : '#bc8cff'
      ctx.beginPath()
      if (point.elite) {
        ctx.moveTo(px, py - size)
        ctx.lineTo(px + size, py)
        ctx.lineTo(px, py + size)
        ctx.lineTo(px - size, py)
        ctx.closePath()
      } else {
        ctx.arc(px, py, size, 0, Math.PI * 2)
      }
      ctx.fill()
    }

    // Player marker and heading cone.
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(heading)
    ctx.fillStyle = '#dffff1'
    ctx.strokeStyle = '#7fd6b5'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(5, 6)
    ctx.lineTo(0, 3)
    ctx.lineTo(-5, 6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  dispose() {
    this.node.remove()
  }
}
