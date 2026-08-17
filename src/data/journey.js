export const JOURNEY_ENVIRONMENT_ART = Object.freeze({
  jade: 'assets/environment/jade-sanctuary-environment-v2.webp',
})

/**
 * 영허검가의 선협 로그라이크 출정 진행 정의.
 *
 * 이야기와 탐사는 자동 전투를 멈춘 별도 보행 모드가 아닙니다. 요괴의
 * 압박과 런 중 성장이 이어지는 동안 각 지점이 다른 조사 목적, 수호
 * 조합, 전투 후 선택과 귀환 후 세계 변화를 제공하는 통합 계약입니다.
 */
export const JOURNEY_CHAPTERS = Object.freeze([
  Object.freeze({
    id: 'jade:guardian',
    stageId: 'jade',
    environmentKeyart: JOURNEY_ENVIRONMENT_ART.jade,
    act: 1,
    chapter: 1,
    indexLabel: '제1장',
    title: '옥산에 번지는 마기',
    shortTitle: '옥산 마기 추적',
    premise: '청람비경의 영맥이 끊기고 요수들이 산문 아래로 밀려오고 있습니다.',
    objective: '옥산에 남은 검흔을 판독하고 봉인 문서를 회수해 옥허진장의 진실에 이르십시오.',
    completionCopy: '옥허진장의 인장을 거두었습니다. 비경 문서에 적염 황야로 이어지는 검흔이 남았습니다.',
    nextGoal: '적염 황야의 검흔을 추적하십시오.',
    entryLabel: '옥산으로 출정',
    route: Object.freeze([
      Object.freeze({
        id: 'broken-meridian', type: 'altar', position: Object.freeze({ x: 10, z: 4 }),
        encounter: Object.freeze({
          kind: 'investigation',
          conclusionLabel: '흩어진 흔적을 대조해 창랑의 행방을 판독하십시오',
          clues: Object.freeze([
            Object.freeze({
              id: 'sword-scar', type: 'evidence', offset: Object.freeze({ x: -3.6, z: -2.4 }),
              label: '절벽을 향한 검흔', observation: '검끝이 아니라 안쪽에서 터진 흔적입니다. 누군가 봉인을 깨고 달아났습니다.',
            }),
            Object.freeze({
              id: 'beast-trail', type: 'false_trace', offset: Object.freeze({ x: 3.8, z: -2.1 }),
              label: '뒤엉킨 요수 발자국', observation: '발자국은 산문 쪽으로 되돌아옵니다. 창랑의 도주로가 아니라 마기에 쫓긴 요수의 흔적입니다.',
            }),
            Object.freeze({
              id: 'seal-ash', type: 'evidence', offset: Object.freeze({ x: 4.6, z: 3.5 }),
              label: '젖은 봉인재', observation: '재에 안개 이슬이 배어 있습니다. 봉인 문서는 동북쪽 옛길로 옮겨졌습니다.',
            }),
          ]),
        }),
        title: '갈라진 검흔', approach: '산문 동쪽 제단에 흩어진 세 흔적을 조사하십시오',
        active: '검흔과 요수의 발자국, 봉인재를 대조하십시오',
        resolve: '세 흔적을 종합해 봉인 문서가 향한 길을 판독하십시오',
        resolved: '검흔이 창랑이 숨은 안개 옛길을 가리킵니다',
        prompt: Object.freeze({ dormant: 'E · 주변 흔적 조사', cleared: 'E · 검흔 판독 완료' }),
        guardians: Object.freeze([]),
        reward: Object.freeze({
          kind: 'blessing-choice', title: '검흔의 깨달음',
          description: '판독한 검흔에서 세 갈래 수행법을 깨우칩니다.',
          options: Object.freeze([
            Object.freeze({ id: 'jade-edge', name: '옥검의 예기', desc: '이번 탐사에서 모든 법보 위력 +12%', mods: Object.freeze([{ stat: 'might', op: 'mul', value: 0.12 }]) }),
            Object.freeze({ id: 'jade-step', name: '유운보', desc: '이번 탐사에서 이동속도 +10%, 재시전 -6%', mods: Object.freeze([{ stat: 'moveSpeed', op: 'mul', value: 0.10 }, { stat: 'cooldown', op: 'add', value: -0.06 }]) }),
            Object.freeze({ id: 'jade-breath', name: '청람 호흡', desc: '기혈 30% 회복, 최대 기혈 +8%', healFraction: 0.30, mods: Object.freeze([{ stat: 'maxHp', op: 'mul', value: 0.08 }]) }),
          ]),
        }),
      }),
      Object.freeze({
        id: 'sealed-record', type: 'treasure', position: Object.freeze({ x: 36, z: 24 }),
        title: '봉인된 비경 문서', approach: '안개가 고인 옛 길에서 봉인 문서를 찾으십시오',
        active: '비경 문서를 삼킨 요왕 창랑을 격파하십시오',
        resolve: '수호진이 꺼진 틈에 비경 문서를 회수하십시오',
        resolved: '문서에서 옥허진장의 봉인 위치를 찾았습니다',
        prompt: Object.freeze({ dormant: 'E · 비경 문서의 봉인 조사', cleared: 'E · 비경 문서 회수' }),
        guardianLabel: '문서를 삼킨 요왕',
        guardianBossId: 'blueWolfKing',
        guardians: Object.freeze([]),
        reward: Object.freeze({
          kind: 'story-choice', title: '봉인 문서의 결단',
          description: '창랑이 지킨 문서에는 옥허진장의 과거와 검가의 잘못이 함께 적혀 있습니다.',
          spiritStones: Object.freeze([28, 45]), experience: Object.freeze([45, 70]),
          options: Object.freeze([
            Object.freeze({
              id: 'record-truth', name: '진상을 새기다', iconId: 'echoing-heart',
              desc: '문서 원본을 천하록에 남깁니다. 법보 위력 +10%',
              outcome: '옥허진장의 과오가 적힌 문서 원본을 천하록에 보존했습니다.',
              mods: Object.freeze([{ stat: 'might', op: 'mul', value: 0.10 }]),
              legacy: Object.freeze({
                name: '천하록의 진본', summary: '다음 옥산 탐사에서 법보 위력 +6%',
                mods: Object.freeze([{ stat: 'might', op: 'mul', value: 0.06 }]),
              }),
            }),
            Object.freeze({
              id: 'redeem-wolf', name: '창랑을 해원하다', iconId: 'purifying-heart',
              desc: '원혼의 집착을 풀어 줍니다. 기혈 35% 회복, 최대 기혈 +10%',
              outcome: '문서를 지키다 요왕이 된 창랑의 원혼을 해원했습니다.',
              healFraction: 0.35, mods: Object.freeze([{ stat: 'maxHp', op: 'mul', value: 0.10 }]),
              legacy: Object.freeze({
                name: '창랑의 보은', summary: '다음 옥산 탐사에서 최대 기혈 +7%',
                mods: Object.freeze([{ stat: 'maxHp', op: 'mul', value: 0.07 }]),
              }),
            }),
            Object.freeze({
              id: 'claim-seal', name: '검가의 인장을 거두다', iconId: 'sword-oath',
              desc: '문서의 봉인술을 검로에 새깁니다. 재시전 -8%, 이동속도 +6%',
              outcome: '봉인 문서의 인장을 거두어 설령의 검로에 새겼습니다.',
              mods: Object.freeze([{ stat: 'cooldown', op: 'add', value: -0.08 }, { stat: 'moveSpeed', op: 'mul', value: 0.06 }]),
              legacy: Object.freeze({
                name: '검가의 봉인술', summary: '다음 옥산 탐사에서 재시전 -5%, 이동속도 +4%',
                mods: Object.freeze([{ stat: 'cooldown', op: 'add', value: -0.05 }, { stat: 'moveSpeed', op: 'mul', value: 0.04 }]),
              }),
            }),
          ]),
        }),
      }),
      Object.freeze({
        id: 'corrupted-seal', type: 'elite_seal', position: Object.freeze({ x: 18, z: 49 }),
        title: '마기에 잠긴 검가 봉인', approach: '문서가 가리킨 절벽 끝의 검가 봉인으로 향하십시오',
        active: '봉인을 뒤틀어 놓은 마수사와 석귀를 격파하십시오',
        resolve: '마기를 걷어 내고 검가의 옥인으로 봉인을 여십시오',
        resolved: '회수한 문서와 옥인이 맞물리며 옥허진장의 결계가 열렸습니다',
        prompt: Object.freeze({ dormant: 'E · 뒤틀린 검가 봉인 조사', cleared: 'E · 검가 봉인 해제' }),
        guardianLabel: '타락한 봉인대',
        guardians: Object.freeze(['demonCultivator', 'demonCultivator', 'stoneGhoul', 'jadeSerpent']),
        reward: Object.freeze({ kind: 'seal-reclaimed', spiritStones: Object.freeze([42, 58]), experience: Object.freeze([90, 125]) }),
      }),
    ]),
    boss: Object.freeze({ id: 'jadeVoidWarden', title: '옥허진장의 결계', objective: '비경 수호자 옥허진장의 시험을 넘으십시오' }),
  }),
])

/**
 * The authored chapter is the story contract; a run's expedition layout is a
 * separate deterministic graph layered on top of it.  Keeping this data out
 * of `chapter.route` means the three required beats stay stable for narrative,
 * save and result consumers while optional detours can change per seed.
 */
const EXPEDITION_TOPOLOGIES = Object.freeze([
  Object.freeze({
    id: 'jade-trail',
    optional: Object.freeze([
      Object.freeze({ id: 'lantern-vow', type: 'altar', requires: Object.freeze(['broken-meridian']), riskTier: 1, guardians: Object.freeze(['wisp', 'talismanGhost']), title: '등화에 남은 맹세', approach: '등불 아래 남은 검가의 맹세를 살피십시오', active: '마기에 잠긴 등화를 정화하십시오', resolved: '등화의 맹세가 이번 출정의 검로에 스며들었습니다', reward: Object.freeze({ kind: 'blessing', stat: 'haste', amount: 0.09 }) }),
      Object.freeze({ id: 'jade-spring', type: 'healing_spring', requires: Object.freeze(['sealed-record']), riskTier: 0, guardians: Object.freeze([]), title: '청람 영천', approach: '문서 뒤편의 청람 영천을 찾으십시오', active: '영천의 흐린 기운을 걷어 내십시오', resolved: '청람 영천이 기혈을 되돌렸습니다', reward: Object.freeze({ kind: 'healing', healthFraction: 0.46 }) }),
    ]),
  }),
  Object.freeze({
    id: 'jade-fork',
    optional: Object.freeze([
      Object.freeze({ id: 'jade-spring', type: 'healing_spring', requires: Object.freeze(['broken-meridian']), riskTier: 0, guardians: Object.freeze([]), title: '청람 영천', approach: '안개 계곡의 청람 영천을 찾으십시오', active: '영천을 막은 요수를 몰아내십시오', resolved: '청람 영천이 기혈을 되돌렸습니다', reward: Object.freeze({ kind: 'healing', healthFraction: 0.38 }) }),
      Object.freeze({ id: 'void-seal', type: 'elite_seal', requires: Object.freeze(['broken-meridian']), riskTier: 2, guardians: Object.freeze(['demonCultivator', 'stoneGhoul', 'jadeSerpent']), title: '허공의 봉인', approach: '갈라진 절벽의 허공 봉인을 조사하십시오', active: '봉인을 먹은 정예 요수를 격파하십시오', resolved: '허공의 봉인에서 위험한 힘을 빼앗았습니다', reward: Object.freeze({ kind: 'treasure', spiritStones: Object.freeze([36, 58]), experience: Object.freeze([80, 118]) }) }),
    ]),
  }),
  Object.freeze({
    id: 'jade-detour',
    optional: Object.freeze([
      Object.freeze({ id: 'lantern-vow', type: 'altar', requires: Object.freeze(['broken-meridian']), riskTier: 1, guardians: Object.freeze(['wisp', 'talismanGhost']), title: '등화에 남은 맹세', approach: '산문 밖 등화의 맹세를 살피십시오', active: '마기에 잠긴 등화를 정화하십시오', resolved: '등화의 맹세가 검로에 스며들었습니다', reward: Object.freeze({ kind: 'blessing', stat: 'power', amount: 0.11 }) }),
      Object.freeze({ id: 'void-seal', type: 'elite_seal', requires: Object.freeze(['sealed-record']), riskTier: 3, guardians: Object.freeze(['demonCultivator', 'stoneGhoul', 'jadeSerpent', 'talismanGhost']), title: '허공의 봉인', approach: '문서가 가리킨 허공 봉인을 조사하십시오', active: '봉인을 먹은 정예 요수를 격파하십시오', resolved: '허공의 봉인에서 위험한 힘을 빼앗았습니다', reward: Object.freeze({ kind: 'treasure', spiritStones: Object.freeze([54, 82]), experience: Object.freeze([118, 168]) }) }),
    ]),
  }),
])

function journeyHash(value) {
  let hash = 0x811c9dc5
  const text = String(value)
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

function journeyUnit(hash) {
  return (hash >>> 0) / 4294967296
}

const EXPEDITION_NODE_ANCHORS = Object.freeze({
  'broken-meridian': Object.freeze({ x: 10, z: 4 }),
  'sealed-record': Object.freeze({ x: 36, z: 24 }),
  'corrupted-seal': Object.freeze({ x: 18, z: 49 }),
  'lantern-vow': Object.freeze({ x: -12, z: 18 }),
  'jade-spring': Object.freeze({ x: 6, z: 24 }),
  'void-seal': Object.freeze({ x: 46, z: 46 }),
})

function layoutPosition(seed, chapterId, nodeId, required) {
  const anchor = EXPEDITION_NODE_ANCHORS[nodeId] ?? { x: 10, z: 4 }
  // Keep the opening clue in its authored sanctuary footprint.  Later nodes
  // receive a small stable offset so different seeds do not feel like the
  // same three screenshots with a different combat RNG.
  if (required && nodeId === 'broken-meridian') return anchor
  const layoutKey = `${chapterId}:${nodeId}:${seed >>> 0}`
  const root = journeyHash(layoutKey)
  const depth = journeyHash(`${layoutKey}:depth`)
  const xJitter = (journeyUnit(root) - 0.5) * 5.2
  const zJitter = (journeyUnit(depth) - 0.5) * 5.2
  return Object.freeze({ x: anchor.x + xJitter, z: anchor.z + zJitter })
}

function freezeLayoutNode(node) {
  return Object.freeze({
    id: node.id,
    beatId: node.beatId ?? null,
    type: node.type,
    required: node.required === true,
    riskTier: Math.max(0, Math.trunc(node.riskTier ?? 0)),
    requires: Object.freeze([...(node.requires ?? [])]),
    next: Object.freeze([...(node.next ?? [])]),
    position: Object.freeze({ x: node.position.x, z: node.position.z }),
    title: node.title ?? null,
    approach: node.approach ?? null,
    active: node.active ?? null,
    resolved: node.resolved ?? null,
    reward: node.reward ?? null,
    guardians: Object.freeze([...(node.guardians ?? [])]),
  })
}

/**
 * Resolve a chapter's deterministic expedition graph for one run seed.
 *
 * The required story beats remain ordered and reachable in every topology.
 * Optional events are genuine graph nodes with prerequisites, not hidden
 * decorations or extra mandatory counters.
 */
export function journeyLayoutFor(seed = 0, chapter = JOURNEY_CHAPTERS[0]) {
  const resolvedChapter = chapter ?? JOURNEY_CHAPTERS[0]
  const unsignedSeed = Number(seed) >>> 0
  const topologies = resolvedChapter.stageId === 'jade'
    ? EXPEDITION_TOPOLOGIES
    : EXPEDITION_TOPOLOGIES.slice(0, 1)
  const topology = topologies[journeyHash(`${resolvedChapter.id}:${unsignedSeed}`) % topologies.length]
  const requiredBeats = (resolvedChapter.route ?? []).map((beat, index) => ({
    id: beat.id,
    beatId: beat.id,
    type: beat.type,
    required: true,
    riskTier: index + 1,
    requires: index === 0 ? [] : [resolvedChapter.route[index - 1].id],
    next: index + 1 < resolvedChapter.route.length ? [resolvedChapter.route[index + 1].id] : [],
    position: layoutPosition(unsignedSeed, resolvedChapter.id, beat.id, true),
    title: beat.title,
    approach: beat.approach,
    active: beat.active,
    resolved: beat.resolved,
    reward: beat.reward,
  }))
  const requiredIds = requiredBeats.map((beat) => beat.id)
  const optional = topology.optional.map((event) => ({
    ...event,
    required: false,
    next: [],
    position: layoutPosition(unsignedSeed, resolvedChapter.id, event.id, false),
  }))
  const nodes = [...requiredBeats, ...optional].map(freezeLayoutNode)
  return Object.freeze({
    version: 1,
    chapterId: resolvedChapter.id,
    stageId: resolvedChapter.stageId,
    seed: unsignedSeed,
    topologyId: topology.id,
    requiredIds: Object.freeze(requiredIds),
    nodes: Object.freeze(nodes),
  })
}

export function journeyLayoutNode(layout, id) {
  return layout?.nodes?.find((node) => node.id === id) ?? null
}

export const JOURNEY_CHAPTER_INDEX = new Map(JOURNEY_CHAPTERS.map((chapter) => [chapter.id, chapter]))

export function getJourneyChapter(id = 'jade:guardian') {
  return JOURNEY_CHAPTER_INDEX.get(id) ?? JOURNEY_CHAPTERS[0]
}

export function getJourneyChapterForStage(stageId = 'jade') {
  return JOURNEY_CHAPTERS.find((chapter) => chapter.stageId === stageId) ?? JOURNEY_CHAPTERS[0]
}

export function nextJourneyChapter(progress) {
  const cleared = new Set(progress?.state?.journey?.chaptersCleared ?? progress?.journey?.chaptersCleared ?? [])
  return JOURNEY_CHAPTERS.find((chapter) => !cleared.has(chapter.id)) ?? JOURNEY_CHAPTERS.at(-1)
}

export function journeyProgressFor(progress) {
  const cleared = new Set(progress?.state?.journey?.chaptersCleared ?? progress?.journey?.chaptersCleared ?? [])
  const completed = JOURNEY_CHAPTERS.filter((chapter) => cleared.has(chapter.id)).length
  return Object.freeze({
    completed,
    total: JOURNEY_CHAPTERS.length,
    current: nextJourneyChapter(progress),
    complete: completed >= JOURNEY_CHAPTERS.length,
  })
}

export function journeyBeat(chapter, routeIndex) {
  return chapter?.route?.[routeIndex] ?? null
}

/** Resolve the latest persistent story decision into a real next-run effect. */
export function journeyLegacyFor(chapter, decisions = []) {
  const latest = Array.isArray(decisions) ? decisions.at(-1) : null
  if (!latest?.choiceId) return null
  for (const beat of chapter?.route ?? []) {
    const option = beat.reward?.options?.find((candidate) => candidate.id === latest.choiceId)
    if (!option?.legacy) continue
    return Object.freeze({
      choiceId: option.id,
      choiceName: option.name,
      name: option.legacy.name,
      summary: option.legacy.summary,
      mods: option.legacy.mods,
    })
  }
  return null
}

export function journeyRewardRoll(range, roll = 0) {
  const minimum = Math.max(0, Math.trunc(range?.[0] ?? 0))
  const maximum = Math.max(minimum, Math.trunc(range?.[1] ?? minimum))
  const unit = Math.max(0, Math.min(0.999999999, Number.isFinite(roll) ? roll : 0))
  return minimum + Math.floor(unit * (maximum - minimum + 1))
}
