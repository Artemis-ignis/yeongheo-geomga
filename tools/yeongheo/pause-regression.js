async page => {
  const timer = () => page.locator('.hud-timer').textContent().then((value) => value?.trim() ?? null)
  await page.keyboard.press('Escape')
  const pausedBefore = await timer()
  await page.waitForTimeout(1_500)
  const pausedAfter = await timer()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
  const resumedAfter = await timer()
  return {
    pausedBefore,
    pausedAfter,
    resumedAfter,
    frozenWhilePaused: pausedBefore === pausedAfter,
    advancedAfterResume: resumedAfter !== pausedAfter,
  }
}
