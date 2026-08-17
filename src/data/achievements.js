/**
 * 업적 — what to try next.
 *
 * The game had unlocks and it had records, and nothing joining them. A player
 * finished a run, saw a number, and was told nothing about what the game wanted
 * from them next; everything buyable was already visible in 단전 with a price on
 * it, so there was no discovery in the loop at all.
 *
 * In every game this one is measured against, the achievement list is the
 * discovery engine — it is where you learn that evolutions exist, that a
 * character you have not touched has a reason to exist, that the run can be
 * survived rather than merely lasted. That is the job here. They are goals
 * first and rewards second, which is why most of them pay 영석 rather than
 * gating content: a locked list you cannot read is a worse tutorial than no
 * list at all.
 *
 * `test` is pure and receives one object, so the whole table is checkable in
 * node with no game running. `scope: 'run'` is evaluated against a finished run,
 * `scope: 'career'` against lifetime records — a distinction that matters
 * because "kill 500 in one run" and "kill 500 ever" are very different asks.
 */

export const ACHIEVEMENTS = [
  // ---- main journey ------------------------------------------------------
  {
    id: 'firstMeridian', name: '영맥의 첫 숨',
    desc: '옥산 본편에서 영맥 하나를 복원한다.',
    scope: 'run', stones: 45,
    test: (r) => r.mode === 'expedition' && r.objectivesCompleted >= 1,
  },
  {
    id: 'sealedDecision', name: '남겨진 결단',
    desc: '봉인 문서의 진실을 마주하고 자신의 선택을 남긴다.',
    scope: 'run', stones: 90,
    test: (r) => r.mode === 'expedition' && r.decisionCount >= 1,
  },
  {
    // Keep the legacy id so old saves retain the earned record.
    id: 'clear', name: '옥산 귀환',
    desc: '옥산에 번지는 마기 제1장을 완수한다.',
    scope: 'run', stones: 250,
    test: (r) => r.mode === 'expedition' && r.victory === true,
  },

  // ---- combat craft ------------------------------------------------------
  {
    id: 'firstBlood', name: '첫 베기',
    desc: '요괴를 100마리 쓰러뜨린다.',
    scope: 'run', stones: 40,
    test: (r) => r.kills >= 100,
  },
  {
    id: 'firstEvolution', name: '법보 진화',
    desc: '법보를 하나 진화시킨다.',
    scope: 'run', stones: 120,
    test: (r) => r.evolutions >= 1,
  },
  {
    id: 'threeEvolutions', name: '삼보재세',
    desc: '한 출정에서 법보 셋을 진화시킨다.',
    scope: 'run', stones: 320,
    test: (r) => r.evolutions >= 3,
  },
  {
    id: 'fullArsenal', name: '만법구족',
    desc: '법보 여섯 자리를 모두 채운다.',
    scope: 'run', stones: 160,
    test: (r) => r.weaponCount >= 6,
  },
  {
    id: 'level30', name: '경지',
    desc: '한 출정에서 30경지에 이른다.',
    scope: 'run', stones: 180,
    test: (r) => r.level >= 30,
  },

  // ---- optional heavenly trial -----------------------------------------
  {
    id: 'survive5', name: '천겁의 초입',
    desc: '천겁 기록전의 첫 대공세를 돌파한다.',
    scope: 'run', stones: 60,
    test: (r) => r.mode !== 'expedition' && r.runTime >= 300,
  },
  {
    // Keep the legacy id so existing saves do not lose an earned badge.
    id: 'survive10', name: '천겁 완수',
    desc: '천겁 기록전의 극한 공세를 끝까지 버틴다.',
    scope: 'run', stones: 140,
    test: (r) => r.mode !== 'expedition' && r.runTime >= 420,
  },

  // ---- mastery ----------------------------------------------------------
  {
    id: 'untouched', name: '무흔',
    desc: '기혈을 한 번도 잃지 않고 3분을 버틴다.',
    scope: 'run', stones: 220,
    test: (r) => r.runTime >= 180 && r.damageTaken === 0,
  },
  {
    id: 'bossSlayer', name: '요괴 토벌',
    desc: '한 출정에서 보스 둘을 쓰러뜨린다.',
    scope: 'run', stones: 200,
    test: (r) => r.bossKills >= 2,
  },
  {
    id: 'trialRunner', name: '역풍을 거슬러',
    desc: '시련 2단계 이상에서 5분을 버틴다.',
    scope: 'run', stones: 300,
    test: (r) => r.mode !== 'expedition' && r.trial >= 2 && r.runTime >= 300,
  },
  {
    id: 'noSkip', name: '일도양단',
    desc: '점괘도 봉인도 쓰지 않고 비경을 완주한다.',
    scope: 'run', stones: 400,
    test: (r) => r.victory === true && r.rerollsUsed === 0 && r.banishesUsed === 0,
  },

  // ---- career -----------------------------------------------------------
  {
    id: 'veteran', name: '백전',
    desc: '출정을 20번 마친다.',
    scope: 'career', stones: 200,
    test: (c) => c.runs >= 20,
  },
  {
    id: 'slayer1000', name: '천참',
    desc: '누적 1000마리를 쓰러뜨린다.',
    scope: 'career', stones: 260,
    test: (c) => c.totalKills >= 1000,
  },
  {
    // The contest release ships one authored cultivator. Its long-form
    // collection goal is therefore the complete released weapon roster.
    id: 'allCharacters', name: '만법전승',
    desc: '해금 가능한 법보 열네 가지를 모두 얻는다.',
    scope: 'career', stones: 350,
    test: (c) => c.unlockedWeapons >= 14,
  },
  {
    id: 'allStages', name: '삼귀',
    desc: '비경 출정을 세 번 완수해 서로 다른 검로를 시험한다.',
    scope: 'career', stones: 600,
    test: (c) => c.expeditionVictories >= 3,
  },
]

export const ACHIEVEMENT_INDEX = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))

export function getAchievement(id) {
  return ACHIEVEMENT_INDEX.get(id)
}

/**
 * Everything newly earned, given a finished run and the career totals.
 *
 * `earned` is the set already held, and is never mutated here — the caller
 * decides whether to bank the result, which keeps this callable from a test or
 * a preview without side effects.
 */
export function evaluate(run, career, earned) {
  const out = []
  for (const a of ACHIEVEMENTS) {
    if (earned?.has?.(a.id) ?? earned?.includes?.(a.id)) continue
    const subject = a.scope === 'career' ? career : run
    let hit = false
    try {
      hit = a.test(subject) === true
    } catch {
      // A malformed record must not take the run's rewards down with it.
      hit = false
    }
    if (hit) out.push(a)
  }
  return out
}
