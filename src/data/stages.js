/**
 * 비경 — the arenas a run can take place in.
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
      ground: 0x263247,
      groundMoss: 0x526d6c,
      grassBase: 0x2d574c,
      grassTip: 0x6e9d84,
      pine: 0x244a43,
      stone: 0x596878,
      fog: 0x829eaf,
      skyTop: 0x161c3f,
      skyMid: 0x5f86ad,
      skyHaze: 0xbfd8e2,
      skyBottom: 0xf2dcb8,
      keyLight: 0xd7e9ff,
      // Keep the moonlit blue in the sky and jade accents, but do not apply a
      // blue multiplier to every foreground material. A neutral highlight grade
      // is what lets white silk, silver trim, and stone relief separate again.
      gradeGain: 0xeeeae2,
      gradeLift: 0x111923,
      gradeSaturation: 1.08,
      gradeContrast: 1.08,
      abyss: 0x2c3f57,
      barrier: 0x6eb7d1,
      mote: 'petal',
      moteTint: 0xffffff,
    // See Terrain._buildMist. Jade's own greens are strong enough to carry the
    // frame; at the old 0.35 they read as a pale wash.
    mistStrength: 0.18,
      moteRise: false,
      // Prop mix. Each 비경 was previously dressed identically — the same pines
      // stood on the burning waste and on the snowfield — so the three read as
      // one arena with three colour filters over it.
      props: { rocks: 46, pines: 40, lanterns: 10, spires: 0, pillars: 0 },
    },
    grassDensity: 0.72,
    // The baseline bestiary. Fire and ice creatures belong to their own 비경 and
    // never wander in here, so this list is explicit rather than `null`.
    roster: [
      'wisp', 'wolf', 'stoneGhoul', 'talismanGhost', 'bloodScorpion', 'demonCultivator',
      'jadeSerpent',
    ],
    bosses: { mid: 'blueWolfKing', final: 'jadeVoidWarden' },
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
      // A cold violet at the zenith. Every tone on this stage was warm, so the
      // frame had no relief anywhere and the fire stopped reading as fire —
      // heat is a comparison, and there was nothing to compare it against.
      skyTop: 0x241a3e,
      skyMid: 0x7e3a3c,
      skyHaze: 0xe0a074,
      skyBottom: 0xffd0a0,
      keyLight: 0xffc58f,
      gradeGain: 0xffdfc4,
      abyss: 0x2a1520,
      // Shadows go cold here even though everything else on the stage is hot.
      gradeLift: 0x1a2242,
      islandCap: 0x5c3a2e,
      islandRock: 0x24161a,
      barrier: 0xff9a5a,
      // Cherry blossom over a burning waste was the single most out-of-place
      // thing on this stage. Embers, and they rise.
      mote: 'spark',
      moteTint: 0xff8a3c,
    // Scorched ground on scorched grass. The mist is this 비경's ambient fill,
    // not its haze: below 0.35 the opening loses three quarters of its pixels
    // to black and enemies at the screen edge stop being visible.
    mistStrength: 0.4,
      moteRise: true,
      // Nothing grows here. Bare rock and basalt spires instead of trees, and
      // only a few lanterns left standing.
      props: { rocks: 74, pines: 0, lanterns: 4, spires: 24, pillars: 0 },
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
      // Snow in shadow, not snow in a photograph.
      //
      // These were all in the 0xd0–0xf0 range and the stage rendered as a
      // white-out: the ice was invisible against the sky, the pines were ghosts,
      // and nothing in the frame had an edge. Lit snow is nearly white, but only
      // the parts facing the sun are lit, and everything here faces a low key
      // light — so the base tones have to sit far darker than the idea of snow
      // suggests. The white is meant to come from the sun hitting it, not from
      // the albedo.
      // Slate-violet, not cyan. Darkening the field fixed the white-out but
      // walked it straight into the ice creatures and the 영기 orb, which are
      // all blue — the contrast gate caught 요랑, 설랑, 빙벽수 and the orb all
      // inside ΔE 25 of the ground. Snow shadow is violet anyway; taking the
      // green out of the ground is what gives everything blue somewhere to
      // stand.
      // Dark, and clearly dark. Two attempts sat this field at mid value —
      // first cyan, then violet — and a mid-value neutral collides with
      // everything: pale ice creatures, dark ones, and the 영기 orb all landed
      // inside it. A deep field gives anything made of ice somewhere to be
      // bright against, which is the whole visual idea of the stage.
      ground: 0x2b3045,
      groundMoss: 0x7d85a0,
      grassBase: 0x333a52,
      grassTip: 0x8e97b2,
      pine: 0x22343c,
      stone: 0x64788a,
      fog: 0x9fb8ca,
      skyTop: 0x121c30,
      skyMid: 0x4d74a0,
      skyHaze: 0xb2cbdc,
      skyBottom: 0xdceaf4,
      keyLight: 0xcfe7ff,
      gradeGain: 0xe0eeff,
      abyss: 0x22303f,
      barrier: 0xbfe8ff,
      islandCap: 0xcfe4f2,
      islandRock: 0x1b2a38,
      mote: 'spark',
      moteTint: 0xe8f6ff,
    // Snow reads as near-white but the palette under it is a saturated blue,
    // and the opening measured 0.98 saturation with a fifth of the frame near
    // black. More haze fixes both at once here.
    mistStrength: 0.26,
      moteRise: false,
      // Frozen pines survive up here, thinned out, among standing ice.
      props: { rocks: 40, pines: 22, lanterns: 8, spires: 0, pillars: 20 },
    },
    grassDensity: 0.35,
    // Ice creatures plus the durable half of the baseline roster. No 혈갈 and no
    // 부적귀 — 설귀 is the caster here, and the split swarm belongs to the plains.
    roster: [
      'wisp', 'wolf', 'stoneGhoul', 'demonCultivator',
      'frostWolf', 'snowWraith', 'glacierWarden',
    ],
    // Her own 비경, and the only one that fields her. 창랑 charges; 빙하 stands
    // off and marks the ground, so the mid fight here is a different problem
    // rather than the same one in a different colour. See `waves.scheduleFor` —
    // this line did nothing at all until that existed.
    bosses: { mid: 'riverMaiden', final: 'darkHeavenLord' },
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
