/**
 * First-run hints.
 *
 * The game explains nothing. It opens on a title screen, and from the moment a
 * run starts the player is expected to know that attacks fire themselves, that
 * the green motes are experience, that 축지법 is on Space and that the panel
 * that interrupts them is a permanent choice. Every one of those is a
 * convention of the genre rather than something the game says out loud, and a
 * player who has not met the genre has no way in.
 *
 * Each hint is a predicate over the run's state and a line of text. Keeping the
 * conditions pure means the whole sequence is testable without a browser, which
 * matters because onboarding is the one flow that by definition nobody on the
 * team ever sees again after the first time.
 */

export const HINTS = [
  {
    id: 'move',
    text: 'WASD · 방향키로 움직인다',
    when: (s) => s.runTime < 3,
    hold: 4,
  },
  {
    id: 'auto',
    text: '법보는 스스로 적을 친다. 살아남는 데 집중하라',
    when: (s) => s.runTime > 4 && s.kills >= 1,
    hold: 4.5,
  },
  {
    id: 'qi',
    text: '쓰러진 자리의 영기를 주워 경지를 올린다',
    when: (s) => s.qiOnGround >= 3,
    hold: 4.5,
  },
  {
    id: 'levelUp',
    text: '경지가 오르면 법보나 공법을 하나 고른다. 이 선택은 되돌릴 수 없다',
    when: (s) => s.level >= 2,
    hold: 5,
  },
  {
    id: 'dash',
    text: 'Space — 축지법. 짧게 파고들거나 빠져나온다',
    when: (s) => s.runTime > 22,
    hold: 4.5,
  },
  {
    id: 'crowd',
    text: '포위당하면 죽는다. 무리를 끌고 다니며 정리하라',
    when: (s) => s.nearbyEnemies >= 12,
    hold: 4.5,
  },
  {
    id: 'hurt',
    text: '기혈이 줄면 회복은 드물다. 맞지 않는 것이 회복이다',
    when: (s) => s.hpFraction < 0.55,
    hold: 4.5,
  },
  {
    id: 'stone',
    text: '영석은 죽어도 남는다. 단전에서 영구 강화에 쓴다',
    when: (s) => s.stones >= 10,
    hold: 5,
  },
  {
    id: 'boss',
    text: '바닥의 붉은 표식은 곧 그 자리에 무언가 떨어진다는 뜻이다',
    when: (s) => s.bossAlive,
    hold: 5,
  },
]

/**
 * The next hint to show, or null.
 *
 * `shown` is the set of ids already used — every hint fires once per save, not
 * once per run, because the second run is not the first time any more.
 */
export function nextHint(state, shown) {
  for (const hint of HINTS) {
    if (shown.has(hint.id)) continue
    if (hint.when(state)) return hint
  }
  return null
}
