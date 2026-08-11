async page => {
  const captureInfo = await page.evaluate(async () => {
    const capture = globalThis.__YEONGHEO_AUDIO_CAPTURE__
    if (!capture || capture.recorder.state !== 'recording') {
      throw new Error('녹음 중인 오디오 캡처를 찾지 못했습니다.')
    }
    await new Promise((resolve, reject) => {
      capture.recorder.addEventListener('stop', resolve, { once: true })
      capture.recorder.addEventListener('error', (event) => reject(event.error), { once: true })
      capture.recorder.stop()
    })
    const blob = new Blob(capture.chunks, { type: capture.mimeType })
    capture.objectUrl = URL.createObjectURL(blob)
    capture.bytes = blob.size
    capture.durationMs = performance.now() - capture.startedAt
    try { capture.source.disconnect(capture.destination) } catch {}
    return {
      bytes: capture.bytes,
      durationMs: capture.durationMs,
      mimeType: capture.mimeType,
      chunks: capture.chunks.length,
    }
  })

  const downloadPromise = page.waitForEvent('download')
  await page.evaluate(() => {
    const capture = globalThis.__YEONGHEO_AUDIO_CAPTURE__
    const anchor = document.createElement('a')
    anchor.href = capture.objectUrl
    anchor.download = 'yeongheo-geomga-release-v5-victory-audio-20260810.webm'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  })
  const download = await downloadPromise
  await download.saveAs('C:/Users/50106/Desktop/3D게임/output/playwright/yeongheo-geomga-release-v5-victory-audio-20260810.webm')
  return captureInfo
}
