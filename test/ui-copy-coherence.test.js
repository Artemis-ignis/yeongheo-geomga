import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const copyFiles = {
  guide: readFileSync(fileURLToPath(new URL('../public/PLAY_GUIDE_KO.txt', import.meta.url)), 'utf8'),
  levelUp: readFileSync(fileURLToPath(new URL('../src/ui/LevelUpModal.js', import.meta.url)), 'utf8'),
  achievements: readFileSync(fileURLToPath(new URL('../src/data/achievements.js', import.meta.url)), 'utf8'),
  metaUpgrades: readFileSync(fileURLToPath(new URL('../src/data/metaUpgrades.js', import.meta.url)), 'utf8'),
}

function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
}

const standaloneGameTerm = new RegExp(`${String.fromCodePoint(0xB7F0)}(?!타임)`, 'u')

describe('world-facing expedition copy', () => {
  it('keeps player-visible copy free of standalone web-game wording', () => {
    const playerCopy = Object.values(copyFiles).map(withoutComments).join('\n')
    expect(playerCopy).not.toMatch(standaloneGameTerm)
  })

  it('names the same product-space action consistently as 출정', () => {
    expect(copyFiles.guide).toContain('이번 출정의 법보·공법')
    expect(copyFiles.levelUp).toContain('이번 출정에서 다시 나오지 않습니다.')
    expect(copyFiles.achievements).toContain('한 출정에서 보스 둘을 쓰러뜨린다.')
    expect(copyFiles.metaUpgrades).toContain('출정에서 얻는 영석이 늘어난다.')
    expect(copyFiles.metaUpgrades).toContain('이번 출정에서 원치 않는 패를 아예 지운다.')
  })
})
