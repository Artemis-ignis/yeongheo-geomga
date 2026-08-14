/** Renderer-independent boss catalogue shared by the codex and 2D runtime. */
export const BOSSES = Object.freeze({
  blueWolfKing: Object.freeze({
    id: 'blueWolfKing', name: '요왕 창랑', desc: '푸른 늑대 군세를 이끄는 요왕으로 거대한 몸집으로 전장을 압박한다.', hp: 12000, radius: 2.6,
    damage: 30, speed: 3.0, scale: 2.2, color: 0x5f7fa8,
  }),
  darkHeavenLord: Object.freeze({
    id: 'darkHeavenLord', name: '마존 흑천', desc: '마기를 두른 최종 마존으로 사방에 천겁의 탄막을 펼친다.', hp: 24000, radius: 2.0,
    damage: 40, speed: 2.6, scale: 1.15, color: 0x4a2a70,
  }),
  jadeVoidWarden: Object.freeze({
    id: 'jadeVoidWarden', name: '옥허진장', desc: '옥허의 결계를 지키는 진장으로 넓은 영역을 봉쇄한다.', hp: 14000, radius: 2.8,
    damage: 32, speed: 2.5, scale: 0.98, color: 0x3d9e8c,
    referenceAsset: 'characters/jade-void-warden-boss-reference-v2.webp',
  }),
  riverMaiden: Object.freeze({
    id: 'riverMaiden', name: '설녀 빙하', desc: '빙하를 타고 흐르는 설녀로 냉기와 추적 공격으로 발을 묶는다.', hp: 6600, radius: 2.2,
    damage: 34, speed: 2.7, scale: 1.15, color: 0x5f93bd,
  }),
})

export function getBoss(id) {
  return BOSSES[id] ?? null
}
