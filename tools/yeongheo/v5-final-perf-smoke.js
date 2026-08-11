async page => {
  const consoleErrors = []
  const consoleWarnings = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
    if (message.type() === 'warning') consoleWarnings.push(message.text())
  })
  page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`))

  await page.setViewportSize({ width: 2560, height: 1600 })
  await page.waitForTimeout(800)
  await page.locator('[data-act="start"]:visible').click()

  const movementKeys = ['w', 'd', 's', 'a']
  let heldKey = null
  let nextDashAt = Date.now() + 1_000
  const deadline = Date.now() + 35_000

  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({
      name: globalThis.__game2d?.state ?? null,
      time: globalThis.__game2d?.world?.runTime ?? 0,
      ended: globalThis.__game2d?.world?.ended ?? false,
    }))
    if (state.ended) break

    const cards = page.locator('.modal-card:visible')
    if (await cards.count()) {
      if (heldKey) {
        await page.keyboard.up(heldKey)
        heldKey = null
      }
      const spirit = page.locator('.modal-card.choice-dao.dao-spirit:visible')
      if (await spirit.count()) await spirit.first().click()
      else await cards.first().click()
      await page.waitForTimeout(160)
      continue
    }

    if (state.name === 'playing') {
      const wantedKey = movementKeys[Math.floor(state.time / 8) % movementKeys.length]
      if (heldKey !== wantedKey) {
        if (heldKey) await page.keyboard.up(heldKey)
        await page.keyboard.down(wantedKey)
        heldKey = wantedKey
      }
      if (Date.now() >= nextDashAt) {
        await page.keyboard.press('Space')
        nextDashAt = Date.now() + 2_600
      }
    }
    await page.waitForTimeout(100)
  }

  if (heldKey) await page.keyboard.up(heldKey)
  for (const key of movementKeys) await page.keyboard.up(key)

  return page.evaluate(({ consoleErrors, consoleWarnings }) => {
    const game = globalThis.__game2d
    const world = game?.world
    const player = world?.player
    const diagnostics = globalThis.__game2dDiagnostics?.() ?? null
    const canvas = document.querySelector('canvas')
    return {
      build: document.querySelector('script[src*="Game2D-"]')?.getAttribute('src') ?? null,
      viewport: [innerWidth, innerHeight],
      canvas: canvas ? [canvas.clientWidth, canvas.clientHeight] : null,
      overflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
      state: game?.state ?? null,
      runTime: world?.runTime ?? 0,
      hp: player?.hp ?? 0,
      maxHp: player?.maxHp ?? 0,
      level: player?.level ?? 0,
      kills: player?.kills ?? 0,
      diagnostics,
      consoleErrors,
      consoleWarnings,
    }
  }, { consoleErrors, consoleWarnings })
}
