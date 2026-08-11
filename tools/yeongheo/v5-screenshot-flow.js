async page => {
  const outputRoot = 'C:/Users/50106/Desktop/3D게임/output/playwright'
  const movementKeys = ['w', 'd', 's', 'a']
  for (const key of movementKeys) await page.keyboard.up(key)

  await page.locator('[data-act="start"]:visible').click()
  await page.waitForTimeout(700)

  const startedAt = Date.now()
  let heldKey = 'd'
  let nextDashAt = startedAt + 1_200
  let capturedGameplay1920 = false
  let capturedLevelUp = false
  let capturedDao = false
  await page.keyboard.down(heldKey)

  while ((Date.now() - startedAt) < 28_000) {
    const elapsed = (Date.now() - startedAt) / 1_000
    const cards = page.locator('.modal-card:visible')
    if (await cards.count()) {
      const daoCards = page.locator('.modal-card.choice-dao:visible')
      if (await daoCards.count()) {
        if (!capturedDao) {
          await page.screenshot({ path: `${outputRoot}/v5-hpfix-dao-vow-1920x1080.png` })
          capturedDao = true
        }
        const spiritVow = page.locator('.modal-card.choice-dao.dao-spirit:visible')
        if (await spiritVow.count()) await spiritVow.first().click()
        else await daoCards.first().click()
      } else {
        if (!capturedLevelUp) {
          await page.screenshot({ path: `${outputRoot}/v5-hpfix-levelup-1920x1080.png` })
          capturedLevelUp = true
        }
        await cards.first().click()
      }
      await page.waitForTimeout(220)
      continue
    }

    if (!capturedGameplay1920 && elapsed >= 8) {
      await page.screenshot({ path: `${outputRoot}/v5-hpfix-gameplay-1920x1080.png` })
      capturedGameplay1920 = true
    }

    if (capturedDao && elapsed >= 23) {
      for (const key of movementKeys) await page.keyboard.up(key)
      await page.setViewportSize({ width: 2560, height: 1600 })
      await page.waitForTimeout(900)
      await page.screenshot({ path: `${outputRoot}/v5-hpfix-gameplay-2560x1600.png` })
      return { capturedGameplay1920, capturedLevelUp, capturedDao, gameplay2560: true }
    }

    const now = Date.now()
    if (now >= nextDashAt) {
      await page.keyboard.press('Space')
      nextDashAt = now + 3_050
    }
    await page.waitForTimeout(160)
  }

  for (const key of movementKeys) await page.keyboard.up(key)
  return { capturedGameplay1920, capturedLevelUp, capturedDao, gameplay2560: false }
}
