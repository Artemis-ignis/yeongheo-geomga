import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const SHOT_DIR = resolve(process.cwd(), '.shots')

/**
 * Dev-only: lets the page POST a rendered frame to disk so it can be inspected
 * without a visible browser window. Never included in a production build.
 */
function screenshotSink() {
  return {
    name: 'screenshot-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8')
            const sep = body.indexOf('\n')
            const name = body.slice(0, sep).replace(/[^a-zA-Z0-9._-]/g, '_')
            const dataUrl = body.slice(sep + 1)
            const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
            const file = resolve(SHOT_DIR, `${name}.png`)
            mkdirSync(dirname(file), { recursive: true })
            writeFileSync(file, Buffer.from(base64, 'base64'))
            res.statusCode = 200
            res.end(file)
          } catch (err) {
            res.statusCode = 500
            res.end(String(err))
          }
        })
      })
    },
  }
}

export default defineConfig({
  base: './',
  server: { open: true },
  build: { target: 'es2022', outDir: 'dist' },
  plugins: [screenshotSink()],
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
})
