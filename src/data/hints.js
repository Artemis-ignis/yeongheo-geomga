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

/**
 * Pick the right Korean particle for a word.
 *
 * `이(가)` and `을(를)` are the form you use in a spec when you do not know the
 * word yet. A game does know — the choice falls out of whether the last syllable
 * has a final consonant, which is arithmetic on the Hangul block. Writing the
 * slashed form on screen is the text equivalent of leaving a placeholder in.
 *
 * @param word The noun the particle follows.
 * @param withFinal Form used after a final consonant (이, 을, 은, 과).
 * @param withoutFinal Form used after a vowel (가, 를, 는, 와).
 */
export function particle(word, withFinal, withoutFinal) {
  const last = String(word ?? '').trim().slice(-1)
  const code = last.charCodeAt(0)
  // Outside the Hangul syllable block there is nothing to inspect; the
  // consonant form is the safer read for the Sino-Korean names used here.
  if (!(code >= 0xac00 && code <= 0xd7a3)) return withFinal
  return (code - 0xac00) % 28 === 0 ? withoutFinal : withFinal
}

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
  {
    id: 'formation',
    text: '마기가 진을 이루면 한쪽이 막힌다. 뚫고 나가거나 돌아가라',
    when: (s) => s.formationSeen === true,
    hold: 5,
  },
  /**
   * The one thing a player cannot work out by playing.
   *
   * Measured over eight fresh-save runs, evolutions decide the outcome outright:
   * sorted by how long they lasted, runs split into "no evolution, dead at four
   * minutes" and "three evolutions, alive at fourteen", with nothing between.
   * And nothing in the game says the pairing exists — a 법보 at its cap looks
   * finished. A player can reach that point a dozen times and never learn why
   * their runs keep ending.
   *
   * Named rather than generic, because "pair a maxed 법보 with its 공법" is a
   * rule to memorise and "비검 is waiting on 검결" is a thing to do next.
   */
  {
    id: 'evolve',
    text: (s) => {
      const { weapon, passive } = s.maxedWeapon
      return `${weapon}${particle(weapon, '이', '가')} 극에 달했다.`
        + ` ${passive}${particle(passive, '을', '를')} 익히면 한 단계 위로 변한다`
    },
    when: (s) => Boolean(s.maxedWeapon),
    hold: 6.5,
    // Not onboarding — see HintOverlay._isOpen.
    always: true,
  },
]

/**
 * The next hint to show, or null.
 *
 * `shown` is the set of ids already used — every hint fires once per save, not
 * once per run, because the second run is not the first time any more.
 *
 * `isOpen` decides whether a hint is still allowed to fire at all; the overlay
 * uses it to retire the onboarding lines after a couple of runs while keeping
 * the ones that state a rule the game never states.
 */
export function nextHint(state, shown, isOpen = () => true) {
  for (const hint of HINTS) {
    if (shown.has(hint.id)) continue
    if (!isOpen(hint)) continue
    if (hint.when(state)) return hint
  }
  return null
}
