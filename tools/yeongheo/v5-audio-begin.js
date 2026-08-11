async page => {
  const started = await page.evaluate(() => {
    const capture = globalThis.__YEONGHEO_AUDIO_CAPTURE__
    if (!capture || capture.recorder.state !== 'inactive') {
      throw new Error('오디오 캡처가 준비된 inactive 상태가 아닙니다.')
    }
    capture.startedAt = performance.now()
    capture.recorder.start(500)
    return { state: capture.recorder.state, startedAt: capture.startedAt }
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  return {
    ...started,
    resumed: await page.evaluate(() => globalThis.__game?.state === 'playing'),
  }
}
