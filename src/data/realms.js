/** 경지 — cultivation realms, shown in place of a bare level number. */
export const REALMS = [
  { minLevel: 1, name: '연기' },
  { minLevel: 5, name: '축기' },
  { minLevel: 10, name: '결단' },
  { minLevel: 15, name: '원영' },
  { minLevel: 20, name: '화신' },
  { minLevel: 25, name: '연허' },
  { minLevel: 30, name: '대승' },
]

export function realmFor(level) {
  let found = REALMS[0]
  for (const r of REALMS) {
    if (level >= r.minLevel) found = r
    else break
  }
  return found
}

/** 영기 needed to go from `level` to `level + 1`. */
export function xpFor(level) {
  return Math.floor(5 + level * 8 + level ** 1.55 * 2.4)
}
