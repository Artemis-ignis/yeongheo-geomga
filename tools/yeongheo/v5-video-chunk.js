async page => {
  const movementKeys = ['w', 'd', 's', 'a']
  for (const key of movementKeys) await page.keyboard.up(key)

  const quickStart = page.locator('[data-act="start"]:visible')
  if (await quickStart.count()) {
    await quickStart.first().click()
    await page.waitForTimeout(900)
  }

  const startedAt = Date.now()
  const stopAt = startedAt + 50_000
  const evidenceDir = await page.evaluate(() => (
    String(globalThis.__YEONGHEO_EVIDENCE_DIR__ || 'output/playwright/v5.2-completion-audit')
  ))
  let directionIndex = await page.evaluate(() => {
    const stored = Number(globalThis.__YEONGHEO_VIDEO_DIRECTION__)
    return Number.isInteger(stored) ? Math.max(0, Math.min(3, stored)) : 0
  })
  let heldKey = movementKeys[directionIndex]
  let nextDirectionAt = startedAt + 6_500
  let nextDashAt = startedAt + 1_600
  let choicesClicked = 0
  let bossCaptureCount = await page.evaluate(() => Number(globalThis.__YEONGHEO_BOSS_CAPTURE_COUNT__) || 0)
  let firstTenCaptured = await page.evaluate(() => Boolean(globalThis.__YEONGHEO_FIRST10_CAPTURED__))
  let daoCaptured = await page.evaluate(() => Boolean(globalThis.__YEONGHEO_DAO_CAPTURED__))
  const startTimerText = await page.locator('.hud-timer').textContent().catch(() => '00:00')
  const [startMinutes, startSeconds] = String(startTimerText).trim().split(':').map(Number)
  const startRunSeconds = (Number(startMinutes) || 0) * 60 + (Number(startSeconds) || 0)
  // Older capture loops could count the same persistent mid-boss twice. Keep
  // one mid-boss slot before 5:30 so the second artifact is reserved for the
  // actual scheduled final encounter.
  if (startRunSeconds < 330 && bossCaptureCount > 1) {
    bossCaptureCount = 1
    await page.evaluate(() => { globalThis.__YEONGHEO_BOSS_CAPTURE_COUNT__ = 1 })
  }

  await page.keyboard.down(heldKey)

  while (Date.now() < stopAt) {
    if (await page.locator('.result-screen:visible').count()) {
      for (const key of movementKeys) await page.keyboard.up(key)
      break
    }

    const choices = page.locator('.modal-card:visible')
    if (await choices.count()) {
      if (!daoCaptured && await page.locator('.modal-card.choice-dao:visible').count()) {
        await page.screenshot({ path: `${evidenceDir}/04-dao-vow-1920x1080.png` })
        daoCaptured = true
        await page.evaluate(() => { globalThis.__YEONGHEO_DAO_CAPTURED__ = true })
      }
      const emergencyRecovery = page.locator('.modal-card.choice-consumable:visible')
      const spiritVow = page.locator('.modal-card.choice-dao.dao-spirit:visible')
      if (await emergencyRecovery.count()) await emergencyRecovery.first().click()
      else if (await spiritVow.count()) await spiritVow.first().click()
      else await choices.first().click()
      choicesClicked += 1
      await page.waitForTimeout(220)
      continue
    }

    const timerText = await page.locator('.hud-timer').textContent().catch(() => '00:00')
    const [minutes, seconds] = String(timerText).trim().split(':').map(Number)
    const runSeconds = (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
    if (!firstTenCaptured && runSeconds >= 8 && runSeconds <= 15) {
      await page.screenshot({ path: `${evidenceDir}/02-first10-1920x1080.png` })
      firstTenCaptured = true
      await page.evaluate(() => { globalThis.__YEONGHEO_FIRST10_CAPTURED__ = true })
    }
    const captureBoss = bossCaptureCount === 0 || (bossCaptureCount === 1 && runSeconds >= 330)
    if (captureBoss && await page.locator('.hud-boss:visible').count()) {
      const filename = bossCaptureCount === 0
        ? `${evidenceDir}/03-midboss-1920x1080.png`
        : `${evidenceDir}/05-finalboss-1920x1080.png`
      await page.screenshot({ path: filename })
      bossCaptureCount += 1
      await page.evaluate((count) => { globalThis.__YEONGHEO_BOSS_CAPTURE_COUNT__ = count }, bossCaptureCount)
    }

    const now = Date.now()
    if (now >= nextDirectionAt) {
      await page.keyboard.up(heldKey)
      directionIndex = (directionIndex + 1) % movementKeys.length
      heldKey = movementKeys[directionIndex]
      await page.keyboard.down(heldKey)
      await page.evaluate((index) => { globalThis.__YEONGHEO_VIDEO_DIRECTION__ = index }, directionIndex)
      nextDirectionAt = now + 6_500
    }

    if (now >= nextDashAt) {
      await page.keyboard.press('Space')
      nextDashAt = now + 3_050
    }

    await page.waitForTimeout(180)
  }

  const resultVisible = Boolean(await page.locator('.result-screen:visible').count())
  const snapshot = await page.evaluate(() => {
    const qa = globalThis.__YEONGHEO_QA__
    return qa?.snapshot?.() ?? null
  })
  const diagnostics = await page.evaluate(() => globalThis.__game2dDiagnostics?.() ?? null)
  const hud = await page.evaluate(() => ({
    timer: document.querySelector('.hud-timer')?.textContent?.trim() ?? null,
    realm: document.querySelector('.hud-realm')?.textContent?.trim() ?? null,
    kills: document.querySelector('.hud-counters .hud-count')?.textContent?.trim() ?? null,
    hp: document.querySelector('.hud-hp-text')?.textContent?.trim() ?? null,
  }))

  return {
    elapsedWallSeconds: Number(((Date.now() - startedAt) / 1_000).toFixed(3)),
    choicesClicked,
    bossCaptureCount,
    resultVisible,
    state: diagnostics?.state ?? snapshot?.state ?? null,
    runTime: diagnostics?.runTime ?? snapshot?.world?.runTime ?? snapshot?.runTime ?? null,
    kills: diagnostics?.kills ?? snapshot?.world?.kills ?? snapshot?.kills ?? null,
    hp: diagnostics?.player?.hp ?? snapshot?.world?.player?.hp ?? snapshot?.player?.hp ?? null,
    level: diagnostics?.level ?? null,
    boss: diagnostics?.boss ?? null,
    hud,
  }
}
