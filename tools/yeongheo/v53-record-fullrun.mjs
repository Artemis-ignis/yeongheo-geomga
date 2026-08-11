import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const workspaceRoot = path.resolve(import.meta.dirname, '..', '..')
const outputDir = path.resolve(
  process.env.YEONGHEO_RECORD_OUTPUT_DIR
    ?? path.join(workspaceRoot, 'output', 'playwright', 'v5.3-current-package-video'),
)
const packageUrl = process.env.YEONGHEO_PACKAGE_URL ?? 'http://127.0.0.1:4202'
const playwrightPackageDir = process.env.PLAYWRIGHT_PACKAGE_DIR
const releaseRunId = process.env.YEONGHEO_RELEASE_RUN_ID
  ?? 'release-v5.3-video-3185791507-1920x1080-20260810'

if (!playwrightPackageDir) {
  throw new Error('PLAYWRIGHT_PACKAGE_DIR must point to the installed playwright package directory.')
}

const playwrightEntry = path.join(path.resolve(playwrightPackageDir), 'index.mjs')
if (!fs.existsSync(playwrightEntry)) {
  throw new Error(`Playwright entry not found: ${playwrightEntry}`)
}

fs.mkdirSync(outputDir, { recursive: true })

const rawVideoPath = path.join(outputDir, 'yeongheo-v5.3-current-package-fullrun-video.webm')
const rawAudioPath = path.join(outputDir, 'yeongheo-v5.3-current-package-fullrun-audio.webm')
const reportPath = path.join(outputDir, 'fullrun-record-report.json')
const { chromium } = await import(pathToFileURL(playwrightEntry).href)

const movementKeys = ['w', 'd', 's', 'a']
const consoleErrors = []
const consoleWarnings = []
const pageErrors = []
let browser
let context
let page
let video
let heldKey = null

function logProgress(label, payload = {}) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), label, ...payload })}\n`)
}

function timerToSeconds(value) {
  const [minutes, seconds] = String(value ?? '00:00').trim().split(':').map(Number)
  return (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
}

async function releaseMovementKeys() {
  if (!page) return
  for (const key of movementKeys) {
    await page.keyboard.up(key).catch(() => {})
  }
  heldKey = null
}

try {
  browser = await chromium.launch({ headless: true })
  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: outputDir,
      size: { width: 1920, height: 1080 },
    },
  })
  const pageCreatedWallMs = Date.now()
  page = await context.newPage()
  video = page.video()

  page.on('console', (message) => {
    const entry = { type: message.type(), text: message.text() }
    if (message.type() === 'error') consoleErrors.push(entry)
    if (message.type() === 'warning') consoleWarnings.push(entry)
  })
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)))

  logProgress('navigate', { packageUrl })
  await page.goto(packageUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.locator('[data-act="start"]:visible').click({ timeout: 30_000 })
  await page.waitForTimeout(900)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  const audioPrepared = await page.evaluate(() => {
    const game = globalThis.__game
    const audio = game?.audio
    const context = audio?.ctx
    const source = audio?.clipper
    if (!context || !source || typeof context.createMediaStreamDestination !== 'function') {
      throw new Error('Active WebAudio output node was not found.')
    }

    const destination = context.createMediaStreamDestination()
    source.connect(destination)
    const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm']
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

  const audioStartWallMs = Date.now()
  const audioStarted = await page.evaluate(() => {
    const capture = globalThis.__YEONGHEO_AUDIO_CAPTURE__
    capture.startedAt = performance.now()
    capture.recorder.start(500)
    return { state: capture.recorder.state, startedAt: capture.startedAt }
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  logProgress('recording-started', {
    audioPrepared,
    audioStarted,
    videoToAudioOffsetSeconds: Number(((audioStartWallMs - pageCreatedWallMs) / 1_000).toFixed(3)),
  })

  const wallStartedAt = Date.now()
  let directionIndex = 0
  let nextDirectionAt = wallStartedAt + 6_500
  let nextDashAt = wallStartedAt + 1_600
  let nextProgressAt = wallStartedAt + 10_000
  let choicesClicked = 0
  let daoChoicesClicked = 0
  let recoveryChoicesClicked = 0
  let resultVisible = false
  let lastHud = null

  heldKey = movementKeys[directionIndex]
  await page.keyboard.down(heldKey)

  while (Date.now() - wallStartedAt < 660_000) {
    if (await page.locator('.result-screen:visible').count()) {
      resultVisible = true
      break
    }

    const choices = page.locator('.modal-card:visible')
    if (await choices.count()) {
      const emergencyRecovery = page.locator('.modal-card.choice-consumable:visible')
      const spiritVow = page.locator('.modal-card.choice-dao.dao-spirit:visible')
      if (await emergencyRecovery.count()) {
        await emergencyRecovery.first().click()
        recoveryChoicesClicked += 1
      } else if (await spiritVow.count()) {
        await spiritVow.first().click()
        daoChoicesClicked += 1
      } else {
        await choices.first().click()
      }
      choicesClicked += 1
      await page.waitForTimeout(220)
      continue
    }

    const now = Date.now()
    if (now >= nextDirectionAt) {
      await page.keyboard.up(heldKey)
      directionIndex = (directionIndex + 1) % movementKeys.length
      heldKey = movementKeys[directionIndex]
      await page.keyboard.down(heldKey)
      nextDirectionAt = now + 6_500
    }
    if (now >= nextDashAt) {
      await page.keyboard.press('Space')
      nextDashAt = now + 3_050
    }
    if (now >= nextProgressAt) {
      lastHud = await page.evaluate(() => ({
        timer: document.querySelector('.hud-timer')?.textContent?.trim() ?? null,
        realm: document.querySelector('.hud-realm')?.textContent?.trim() ?? null,
        hp: document.querySelector('.hud-hp-text')?.textContent?.trim() ?? null,
      }))
      logProgress('gameplay', {
        timer: lastHud.timer,
        runSeconds: timerToSeconds(lastHud.timer),
        hp: lastHud.hp,
        choicesClicked,
      })
      nextProgressAt = now + 10_000
    }
    await page.waitForTimeout(180)
  }

  await releaseMovementKeys()
  await page.waitForTimeout(1_500)

  const finalSnapshot = await page.evaluate(() => ({
    diagnostics: globalThis.__game2dDiagnostics?.() ?? null,
    qa: globalThis.__YEONGHEO_QA__?.snapshot?.() ?? null,
    resultText: document.querySelector('.result-screen')?.textContent?.replace(/\s+/g, ' ')?.trim() ?? null,
    hud: {
      timer: document.querySelector('.hud-timer')?.textContent?.trim() ?? null,
      realm: document.querySelector('.hud-realm')?.textContent?.trim() ?? null,
      hp: document.querySelector('.hud-hp-text')?.textContent?.trim() ?? null,
    },
  }))

  const captureInfo = await page.evaluate(async () => {
    const capture = globalThis.__YEONGHEO_AUDIO_CAPTURE__
    if (!capture || capture.recorder.state !== 'recording') {
      throw new Error('Audio recorder is not active at the end of the run.')
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
    anchor.download = 'yeongheo-v5.3-current-package-fullrun-audio.webm'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  })
  const download = await downloadPromise
  await download.saveAs(rawAudioPath)

  const report = {
    releaseRunId,
    packageUrl,
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    actualInput: {
      movement: 'WASD clockwise every 6.5 seconds',
      dash: 'Space every 3.05 seconds',
      choices: 'recovery first, spirit Dao second, otherwise first visible card',
      damageBypass: false,
      timeSkip: false,
      forcedBoss: false,
    },
    resultVisible,
    wallDurationSeconds: Number(((Date.now() - wallStartedAt) / 1_000).toFixed(3)),
    videoToAudioOffsetSeconds: Number(((audioStartWallMs - pageCreatedWallMs) / 1_000).toFixed(3)),
    choicesClicked,
    daoChoicesClicked,
    recoveryChoicesClicked,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    audio: captureInfo,
    finalSnapshot,
    files: {
      rawVideoPath,
      rawAudioPath,
    },
  }

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  logProgress('run-finished', {
    resultVisible,
    timer: finalSnapshot.hud.timer,
    state: finalSnapshot.diagnostics?.state ?? finalSnapshot.qa?.state ?? null,
    choicesClicked,
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
  })

  await page.close()
  await context.close()
  context = null
  await video.saveAs(rawVideoPath)
  await browser.close()
  browser = null

  logProgress('artifacts-saved', { rawVideoPath, rawAudioPath, reportPath })
} catch (error) {
  await releaseMovementKeys().catch(() => {})
  await page?.close().catch(() => {})
  await context?.close().catch(() => {})
  await browser?.close().catch(() => {})
  throw error
}
