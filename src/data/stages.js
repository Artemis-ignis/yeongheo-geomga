/**
 * 비경(秘境) — the arenas a run can take place in.
 *
 * A stage is entirely data: a palette that drives terrain, sky and grass, a
 * roster that filters which enemies the wave table may draw, a boss pair, and a
 * few tuning multipliers. Adding a fourth stage is a table entry, not code.
 */
export const STAGES = [
  {
    id: 'jade',
    name: '청람비경',
    desc: '마기가 스며들기 시작한 옥산 고원. 바람에 풀이 눕는다.',
    unlockCost: 0,
    palette: {
      ground: 0x2b4d42,
      groundMoss: 0x96d696,
      grassBase: 0x2f6b4f,
      grassTip: 0x9fd88a,
      pine: 0x2d5442,
      stone: 0x7d7466,
      fog: 0x9db9c9,
      skyTop: 0x161c3f,
      skyMid: 0x5f86ad,
      skyHaze: 0xbfd8e2,
      skyBottom: 0xf2dcb8,
      abyss: 0x2c3f57,
      barrier: 0x8fd8ff,
      mote: 'petal',
      moteTint: 0xffffff,
      moteRise: false,
    },
    grassDensity: 1.0,
    // The baseline bestiary. Fire and ice creatures belong to their own 비경 and
    // never wander in here, so this list is explicit rather than `null`.
    roster: [
      'wisp', 'wolf', 'stoneGhoul', 'talismanGhost', 'bloodScorpion', 'demonCultivator',
      'jadeSerpent',
    ],
    bosses: { mid: 'blueWolfKing', final: 'darkHeavenLord' },
    hpScale: 1.0,
    stoneScale: 1.0,
  },
  {
    id: 'ember',
    name: '적염비경',
    desc: '불에 그을린 붉은 대지. 재가 끝없이 흩날린다.',
    unlockCost: 900,
    palette: {
      // Scorched ash, not red dirt. Every creature on this stage is some shade
      // of fire, so a red-orange ground put 용암귀, 혈갈, 부적귀 and 마수사 all
      // under ΔE 16 against the floor they walk on — and darkening it without
      // shifting the hue only traded that for a worse collision with the dark
      // ones. Pulling the chroma out is what separates them: the fire in this
      // 비경 belongs to the sky and the things trying to kill you.
      ground: 0x3a2f2a,
      groundMoss: 0x7a5a48,
      // The fire lives here rather than in the ground tone: thin hot veins cover
      // almost none of the surface, so they read as drama without raising the
      // floor's value back into the creatures walking on it.
      groundVein: 0xff6a1e,
      grassBase: 0x4a3a30,
      grassTip: 0x9c7a58,
      pine: 0x4a3a2e,
      stone: 0x6e4a3c,
      fog: 0xc98a6a,
      skyTop: 0x2a1018,
      skyMid: 0x8a3a2c,
      skyHaze: 0xe0a074,
      skyBottom: 0xffd0a0,
      abyss: 0x3a1712,
      barrier: 0xff9a5a,
      // Cherry blossom over a burning waste was the single most out-of-place
      // thing on this stage. Embers, and they rise.
      mote: 'spark',
      moteTint: 0xff8a3c,
      moteRise: true,
    },
    grassDensity: 0.55,
    // Fire creatures plus the fast half of the baseline roster. 석귀 is dropped:
    // this stage is about pressure, and 용암귀 is the heavy it fields instead.
    roster: [
      'wisp', 'wolf', 'talismanGhost', 'bloodScorpion', 'demonCultivator',
      'emberSprite', 'ashRaven', 'magmaBrute',
    ],
    bosses: { mid: 'blueWolfKing', final: 'darkHeavenLord' },
    hpScale: 1.25,
    stoneScale: 1.35,
  },
  {
    id: 'frost',
    name: '한천비경',
    desc: '만년설이 덮인 고봉. 숨을 쉴 때마다 폐가 얼어붙는다.',
    unlockCost: 2200,
    palette: {
      ground: 0x5e7386,
      groundMoss: 0xd8ecf5,
      grassBase: 0x6a8496,
      grassTip: 0xd0e8f2,
      pine: 0x2f4a52,
      stone: 0x8c9aa8,
      fog: 0xcfe0ea,
      skyTop: 0x1c2a44,
      skyMid: 0x6d90b4,
      skyHaze: 0xd8e8f2,
      skyBottom: 0xf0f6ff,
      abyss: 0x33465c,
      barrier: 0xbfe8ff,
      mote: 'spark',
      moteTint: 0xe8f6ff,
      moteRise: false,
    },
    grassDensity: 0.35,
    // Ice creatures plus the durable half of the baseline roster. No 혈갈 and no
    // 부적귀 — 설귀 is the caster here, and the split swarm belongs to the plains.
    roster: [
      'wisp', 'wolf', 'stoneGhoul', 'demonCultivator',
      'frostWolf', 'snowWraith', 'glacierWarden',
    ],
    bosses: { mid: 'blueWolfKing', final: 'darkHeavenLord' },
    hpScale: 1.55,
    stoneScale: 1.8,
  },
]

export const STAGE_INDEX = new Map(STAGES.map((s, i) => [s.id, i]))

export function getStage(id) {
  return STAGES[STAGE_INDEX.get(id) ?? 0]
}

/**
 * Filter a wave band's enemy list to what this stage allows.
 * Falls back to the band's own list when the stage has no roster, and never
 * returns empty — a band that filtered to nothing would silently stop spawning.
 */
export function rosterFor(stage, types) {
  if (!stage?.roster) return types
  const allowed = types.filter((t) => stage.roster.includes(t))
  return allowed.length > 0 ? allowed : [stage.roster[0]]
}
