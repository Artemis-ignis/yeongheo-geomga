import { readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SUBMISSION_RUNTIME_ASSETS } from '../tools/submission-assets.mjs'

const root = resolve(process.cwd())
const launcher = readFileSync(resolve(root, 'tools/start-game.ps1'), 'utf8')
const server = readFileSync(resolve(root, 'tools/serve-dist.ps1'), 'utf8')
const packager = readFileSync(resolve(root, 'tools/package-release.ps1'), 'utf8')
const quietLauncher = readFileSync(resolve(root, '영허검가 실행.vbs'), 'utf8')
const launcherCode = launcher.replace(/^\s*#.*$/gm, '')

const delay = (ms) => new Promise((done) => setTimeout(done, ms))

async function reservePort() {
  const socket = createServer()
  socket.listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const port = socket.address().port
  await new Promise((done, reject) => socket.close((error) => error ? reject(error) : done()))
  return port
}

describe('Windows release launcher contract', () => {
  it('runs the built dist without Node, serves safely, and opens at most one browser navigation', () => {
    expect(launcher.charCodeAt(0)).toBe(0xFEFF)
    expect(server.charCodeAt(0)).toBe(0xFEFF)
    expect(existsSync(resolve(root, 'dist/index.html'))).toBe(true)
    expect(existsSync(resolve(root, 'tools/serve-dist.ps1'))).toBe(true)
    expect(existsSync(resolve(root, '게임시작.bat'))).toBe(false)
    expect(quietLauncher).toContain('tools\\start-game.ps1')
    expect(quietLauncher).toContain('shell.Run command, 7, False')
    expect(quietLauncher).toContain('YEONGHEO_TEST_MODE')
    expect(launcher).toContain('YEONGHEO_NO_BROWSER')
    expect(launcher).toContain('Start-Process -FilePath \'explorer.exe\'')
    expect(launcher).toContain("$publicGameUrl = 'https://yeongheo-geomga.vercel.app/'")
    expect(launcher).toContain('Open-GameOnce -Url $publicGameUrl')
    expect(launcher).not.toContain('개발 환경에서 npm run build를 실행한 뒤 배포 폴더를 함께 전달해 주세요.')
    expect(launcher).toContain('serve-dist.ps1')
    expect(launcherCode).not.toMatch(/Find-NodeExecutable|viteCli|node\.exe/i)
    expect(server).toContain('HttpListener')
    expect(server).toContain('X-Content-Type-Options')
    expect(server).toContain('Resolve-SafeFilePath')
    expect(server).toContain('GET\' -and $method -ne \'HEAD\'')
    expect(server).toContain('Test-ParentAlive')
  })

  it('creates separate portable and web archives with normalized ZIP entries', () => {
    expect(packager.charCodeAt(0)).toBe(0xFEFF)
    expect(packager).toContain('ZipArchive')
    expect(packager).toContain('ConvertTo-ZipEntryName')
    expect(packager).toContain("Replace('\\', '/')")
    expect(packager).toContain('windows-portable')
    expect(packager).toContain('영허검가 실행.vbs')
    expect(packager).toContain('web-release')
    expect(packager).toContain('기존 릴리스 파일을 덮어쓰지 않습니다')
    expect(packager).toContain('AllowUnclearedRights')
    expect(packager).toContain('권리 게이트가 BLOCKED입니다')
    expect(packager).toContain('$publicParityFiles')
    expect(packager).toContain('public과 dist 문서가 다릅니다')
    expect(packager).toContain('[string]::IsNullOrWhiteSpace($EntryPrefix)')
    expect(packager).not.toContain('Compress-Archive')
  })

  it.runIf(process.platform === 'win32')('serves the first request after multiple idle parent checks', async () => {
    const port = await reservePort()
    const child = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', resolve(root, 'tools/serve-dist.ps1'),
      '-Root', resolve(root, 'dist'),
      '-Port', String(port),
      '-ParentPid', String(process.pid),
    ], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })

    try {
      const deadline = Date.now() + 10_000
      while (!stdout.includes('YEONGHEO_SERVER_READY')) {
        if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}: ${stderr}`)
        if (Date.now() > deadline) throw new Error(`server readiness timeout: ${stdout} ${stderr}`)
        await delay(50)
      }

      // Two one-second liveness intervals used to create two abandoned accept
      // tasks, causing this very first request to hang indefinitely.
      await delay(2_300)
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(4_000) })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toMatch(/^text\/html/)
      expect(await response.text()).toContain('<title>영허검가</title>')

      const metadata = await fetch(`http://127.0.0.1:${port}/release.json`, { signal: AbortSignal.timeout(4_000) })
      expect(metadata.status).toBe(200)
      const releaseMetadata = await metadata.json()
      expect(releaseMetadata.releaseId).toBe('yeongheo-current-20260814')
      expect(releaseMetadata.runtimeImageAssets).toBe(SUBMISSION_RUNTIME_ASSETS.length)
    } finally {
      if (child.exitCode === null) {
        child.kill()
        await Promise.race([once(child, 'exit'), delay(3_000)])
      }
    }
  }, 20_000)
})
