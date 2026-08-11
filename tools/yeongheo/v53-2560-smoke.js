async page => {
  const quickStart = page.locator('[data-act="start"]:visible')
  if (await quickStart.count()) await quickStart.first().click()

  const deadline = Date.now() + 20_000
  let dashes = 0
  while (Date.now() < deadline) {
    const choices = page.locator('.modal-card:visible')
    if (await choices.count()) {
      await choices.first().click()
      await page.waitForTimeout(100)
      continue
    }
    await page.keyboard.down('d')
    if (dashes < 5) {
      await page.keyboard.press('Space')
      dashes++
    }
    await page.waitForTimeout(500)
    await page.keyboard.up('d')
  }
  while (await page.locator('.modal-card:visible').count()) {
    await page.locator('.modal-card:visible').first().click()
    await page.waitForTimeout(80)
  }

  await page.screenshot({ path: 'output/releases/screenshots-v5.3/08-gameplay-2560x1600.png' })
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const root = document.documentElement
    const body = document.body
    return {
      viewport: { width: innerWidth, height: innerHeight },
      canvas: canvas ? {
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        width: canvas.width,
        height: canvas.height,
      } : null,
      overflow: {
        x: Math.max(root.scrollWidth, body?.scrollWidth || 0) - innerWidth,
        y: Math.max(root.scrollHeight, body?.scrollHeight || 0) - innerHeight,
      },
      diagnostics: globalThis.__game2dDiagnostics?.() ?? null,
      timer: document.querySelector('.hud-timer')?.textContent?.trim() ?? null,
      hp: document.querySelector('.hud-hp-text')?.textContent?.trim() ?? null,
    }
  })
}
