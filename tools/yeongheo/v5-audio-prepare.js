async page => {
  await page.locator('[data-act="start"]:visible').click()
  await page.waitForTimeout(900)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  return page.evaluate(() => {
    const game = globalThis.__game
    const audio = game?.audio
    const context = audio?.ctx
    const source = audio?.clipper
    if (!context || !source || typeof context.createMediaStreamDestination !== 'function') {
      throw new Error('실행 중인 WebAudio 출력 노드를 찾지 못했습니다.')
    }
    if (globalThis.__YEONGHEO_AUDIO_CAPTURE__) {
      throw new Error('이미 오디오 캡처가 준비되어 있습니다.')
    }

    const destination = context.createMediaStreamDestination()
    source.connect(destination)
    const mimeCandidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
    ]
    const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
    const recorder = new MediaRecorder(destination.stream, mimeType ? {
      mimeType,
      audioBitsPerSecond: 192_000,
    } : undefined)
    const chunks = []
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) chunks.push(event.data)
    })
    globalThis.__YEONGHEO_AUDIO_CAPTURE__ = {
      recorder,
      chunks,
      destination,
      source,
      mimeType: recorder.mimeType || mimeType || 'audio/webm',
      startedAt: null,
    }
    return {
      contextState: context.state,
      audioTracks: destination.stream.getAudioTracks().length,
      mimeType: recorder.mimeType || mimeType,
      paused: game?.state === 'paused',
    }
  })
}
