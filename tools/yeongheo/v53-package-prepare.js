async page => page.evaluate(() => {
  globalThis.__YEONGHEO_EVIDENCE_DIR__ = 'output/releases/screenshots-v5.3'
  globalThis.__YEONGHEO_BOSS_CAPTURE_COUNT__ = 0
  globalThis.__YEONGHEO_FIRST10_CAPTURED__ = false
  globalThis.__YEONGHEO_DAO_CAPTURED__ = false
  globalThis.__YEONGHEO_VIDEO_DIRECTION__ = 0
  return { evidenceDir: globalThis.__YEONGHEO_EVIDENCE_DIR__ }
})
