async page => {
  while (await page.locator('.modal-card:visible').count()) {
    await page.locator('.modal-card:visible').first().click()
    await page.waitForTimeout(100)
  }
  await page.keyboard.down('w')
  await page.keyboard.down('d')
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Space')
    await page.waitForTimeout(650)
    while (await page.locator('.modal-card:visible').count()) {
      await page.keyboard.up('w')
      await page.keyboard.up('d')
      await page.locator('.modal-card:visible').first().click()
      await page.waitForTimeout(100)
      await page.keyboard.down('w')
      await page.keyboard.down('d')
    }
  }
  await page.keyboard.up('w')
  await page.keyboard.up('d')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'output/releases/screenshots-v5.3/09-gameplay-2560x1600.png' })
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
      timer: document.querySelector('.hud-timer')?.textContent?.trim() ?? null,
      hp: document.querySelector('.hud-hp-text')?.textContent?.trim() ?? null,
      diagnostics: globalThis.__game2dDiagnostics?.() ?? null,
    }
  })
}
