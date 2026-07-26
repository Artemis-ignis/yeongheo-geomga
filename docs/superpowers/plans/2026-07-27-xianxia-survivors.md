# 영허검가 (靈墟劍歌) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based Vampire Survivors-like game in Three.js with a 미소녀 + 선협(仙俠) theme — three playable cultivator girls, 8 auto-firing 법보 with 4 evolutions, 6 enemy types plus 2 bosses, on a 15-minute run.

**Architecture:** A fixed-timestep (60Hz) simulation decoupled from rendering, with all gameplay entities held in fixed-capacity object pools backed by typed arrays. Enemies, projectiles, pickups and VFX each render as a single `InstancedMesh` per type, so a 500+ enemy horde costs a handful of draw calls. Collision broadphase is a uniform spatial hash rebuilt each tick. Balance data lives entirely in `src/data/` and is validated at boot. The HUD is real DOM over the canvas; floating combat text is drawn on one 2D overlay canvas.

**Tech Stack:** Three.js `0.185.1`, Vite `8.1.5`, Vitest `4.1.10`, vanilla ES modules, no framework, no external art or audio assets.

## Global Constraints

- **Node/tooling:** `three@^0.185.1`, `vite@^8.1.5`, `vitest@^4.1.10`. ES modules only (`"type": "module"`). No TypeScript.
- **No external assets.** No image, model, font, or audio files. Every texture is generated at runtime with Canvas2D; every mesh is built from Three.js primitives. Fonts are system CJK stacks only.
- **No audio.** No `audio/` module, no `AudioContext`, no SFX or music. Out of scope by user decision.
- **All player-visible text is Korean** (with hanja where the spec gives it). Code identifiers, comments, and commit messages are English.
- **No allocation in the hot loop.** During `simulate()` and `render()`, do not create objects, arrays, closures, or `THREE.Vector3` instances. Use module-scope scratch vectors and preallocated pools.
- **Balance numbers live only in `src/data/`.** No magic gameplay numbers in `combat/`, `entities/`, or `world/`.
- **Simulation is deterministic** given a seed: all gameplay randomness goes through `core/RNG.js`. Cosmetic-only randomness (petals, prop scatter) may use `Math.random`.
- **Fixed timestep is `1/60`.** Never read `performance.now()` inside simulation code.
- **Spec:** `docs/superpowers/specs/2026-07-27-xianxia-survivors-design.md` is the authority on all numbers. When this plan and the spec disagree, the spec wins.

---

### Task 1: Project scaffold, build tooling, and render smoke test

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `styles/hud.css`
- Create: `test/smoke.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm run dev` / `npm run build` / `npm test`. `src/main.js` exports nothing; it is the entry script.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "yeongheo-geomga",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "three": "^0.185.1"
  },
  "devDependencies": {
    "vite": "^8.1.5",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { open: true },
  build: { target: 'es2022', outDir: 'dist' },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
})
```

- [ ] **Step 3: Create `index.html`**

The canvas fills the window; `#hud` is a pointer-events-none DOM layer above it; `#overlay` is the 2D
combat-text canvas between them. `#fallback` is hidden and only shown when WebGL2 is missing.

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>영허검가 靈墟劍歌</title>
    <link rel="stylesheet" href="/styles/hud.css" />
  </head>
  <body>
    <div id="app">
      <canvas id="scene"></canvas>
      <canvas id="overlay"></canvas>
      <div id="hud"></div>
      <div id="fallback" hidden></div>
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `styles/hud.css` with the base layer stack**

```css
:root {
  --jade: #7fd6b5;
  --gold: #e8c56a;
  --ink: #0d1117;
  --blood: #d9534f;
  --font-kr: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { width: 100%; height: 100%; overflow: hidden; background: var(--ink); }
body { font-family: var(--font-kr); color: #fff; user-select: none; }
#scene, #overlay { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#overlay { pointer-events: none; }
#hud { position: absolute; inset: 0; pointer-events: none; }
#hud .clickable { pointer-events: auto; }
#fallback { position: absolute; inset: 0; display: grid; place-items: center; padding: 2rem;
            text-align: center; line-height: 1.7; background: var(--ink); }
#fallback[hidden] { display: none; }
```

- [ ] **Step 5: Create `src/main.js` — a spinning jade octahedron to prove the pipeline**

```js
import * as THREE from 'three'

const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0d1117)
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500)
camera.position.set(0, 2, 6)
camera.lookAt(0, 0, 0)

scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x2a3a2a, 2.0))
const mesh = new THREE.Mesh(
  new THREE.OctahedronGeometry(1.2, 0),
  new THREE.MeshStandardMaterial({ color: 0x7fd6b5, flatShading: true }),
)
scene.add(mesh)

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

renderer.setAnimationLoop((t) => {
  mesh.rotation.y = t * 0.001
  mesh.rotation.x = t * 0.0006
  renderer.render(scene, camera)
})
```

- [ ] **Step 6: Create `test/smoke.test.js`**

```js
import { describe, it, expect } from 'vitest'
import pkg from '../package.json' with { type: 'json' }

describe('project scaffold', () => {
  it('is an ES module project', () => {
    expect(pkg.type).toBe('module')
  })
  it('depends on three', () => {
    expect(pkg.dependencies.three).toBeDefined()
  })
})
```

- [ ] **Step 7: Install and verify tests fail-then-pass**

```bash
npm install
```

Then run:

```bash
npm test
```

Expected: 2 tests pass. (This task's test is a scaffold check, not TDD — the TDD cycle starts in Task 2.)

- [ ] **Step 8: Verify the dev server renders**

```bash
npm run dev
```

Expected: browser opens to a dark screen with a slowly rotating jade octahedron, no console errors.
Stop the server before continuing.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html src/main.js styles/hud.css test/smoke.test.js
git commit -m "chore: scaffold Vite + Three.js project with render smoke test"
```

---

### Task 2: `core/RNG.js` — seeded deterministic PRNG

**Files:**
- Create: `src/core/RNG.js`
- Test: `test/rng.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class RNG { constructor(seed: number); next(): number /* [0,1) */; int(maxExclusive: number): number; range(min: number, max: number): number; pick(array: T[]): T; chance(p: number): boolean; }`
  - `export function makeSeed(): number` — a random 32-bit seed for a new run.

- [ ] **Step 1: Write the failing test**

`test/rng.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { RNG, makeSeed } from '../src/core/RNG.js'

describe('RNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new RNG(12345)
    const b = new RNG(12345)
    const seqA = Array.from({ length: 50 }, () => a.next())
    const seqB = Array.from({ length: 50 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('diverges for different seeds', () => {
    const a = new RNG(1)
    const b = new RNG(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('stays within [0, 1)', () => {
    const r = new RNG(999)
    for (let i = 0; i < 5000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int() returns integers in [0, maxExclusive)', () => {
    const r = new RNG(7)
    for (let i = 0; i < 2000; i++) {
      const v = r.int(6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
    }
  })

  it('range() spans the requested interval', () => {
    const r = new RNG(42)
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 5000; i++) {
      const v = r.range(-3, 7)
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    expect(min).toBeGreaterThanOrEqual(-3)
    expect(max).toBeLessThan(7)
    expect(min).toBeLessThan(-2.5)
    expect(max).toBeGreaterThan(6.5)
  })

  it('pick() only returns members of the array', () => {
    const r = new RNG(3)
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 200; i++) expect(arr).toContain(r.pick(arr))
  })

  it('chance(0) is never true and chance(1) is always true', () => {
    const r = new RNG(5)
    for (let i = 0; i < 200; i++) {
      expect(r.chance(0)).toBe(false)
      expect(r.chance(1)).toBe(true)
    }
  })

  it('makeSeed returns a 32-bit unsigned integer', () => {
    for (let i = 0; i < 100; i++) {
      const s = makeSeed()
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThan(2 ** 32)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run test/rng.test.js
```

Expected: FAIL — `Failed to resolve import "../src/core/RNG.js"`.

- [ ] **Step 3: Write the implementation**

`src/core/RNG.js`:

```js
/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 * All gameplay randomness goes through this so runs are reproducible from a seed.
 */
export class RNG {
  constructor(seed) {
    this.seed = seed >>> 0
    this.state = this.seed
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int(maxExclusive) {
    return Math.floor(this.next() * maxExclusive)
  }

  range(min, max) {
    return min + this.next() * (max - min)
  }

  pick(array) {
    return array[this.int(array.length)]
  }

  chance(p) {
    if (p <= 0) return false
    if (p >= 1) return true
    return this.next() < p
  }
}

export function makeSeed() {
  return (Math.random() * 4294967296) >>> 0
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run test/rng.test.js
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/RNG.js test/rng.test.js
git commit -m "feat(core): add seeded mulberry32 RNG for deterministic runs"
```

---

### Task 3: `core/Pool.js` — fixed-capacity index pool

**Files:**
- Create: `src/core/Pool.js`
- Test: `test/pool.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class Pool { constructor(capacity: number); get capacity: number; get count: number /* live count */; get dropped: number; acquire(): number /* index, or -1 when full */; release(index: number): void; isAlive(index: number): boolean; clear(): void; }`
  - Live indices are always the dense range `[0, count)`. `release(i)` swaps the last live slot into `i`; the caller must mirror that swap in its own parallel arrays, so `release` returns nothing but exposes `lastSwappedFrom` — the index that was moved into the released slot, or `-1` if the released slot was already last.

- [ ] **Step 1: Write the failing test**

`test/pool.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { Pool } from '../src/core/Pool.js'

describe('Pool', () => {
  it('hands out dense indices starting at 0', () => {
    const p = new Pool(4)
    expect(p.acquire()).toBe(0)
    expect(p.acquire()).toBe(1)
    expect(p.acquire()).toBe(2)
    expect(p.count).toBe(3)
  })

  it('returns -1 and counts a drop when at capacity', () => {
    const p = new Pool(2)
    p.acquire()
    p.acquire()
    expect(p.acquire()).toBe(-1)
    expect(p.dropped).toBe(1)
    expect(p.count).toBe(2)
  })

  it('keeps the live range dense after a middle release', () => {
    const p = new Pool(4)
    p.acquire() // 0
    p.acquire() // 1
    p.acquire() // 2
    p.release(0)
    expect(p.count).toBe(2)
    expect(p.isAlive(0)).toBe(true)
    expect(p.isAlive(1)).toBe(true)
    expect(p.isAlive(2)).toBe(false)
  })

  it('reports which slot was swapped into the released one', () => {
    const p = new Pool(4)
    p.acquire()
    p.acquire()
    p.acquire()
    p.release(0)
    expect(p.lastSwappedFrom).toBe(2)
  })

  it('reports -1 when releasing the last live slot', () => {
    const p = new Pool(4)
    p.acquire()
    p.acquire()
    p.release(1)
    expect(p.lastSwappedFrom).toBe(-1)
  })

  it('ignores releasing a dead slot', () => {
    const p = new Pool(4)
    p.acquire()
    p.release(0)
    p.release(0)
    expect(p.count).toBe(0)
  })

  it('survives many acquire/release cycles without leaking', () => {
    const p = new Pool(64)
    for (let cycle = 0; cycle < 10000; cycle++) {
      const n = 1 + (cycle % 64)
      for (let i = 0; i < n; i++) p.acquire()
      while (p.count > 0) p.release(p.count - 1)
    }
    expect(p.count).toBe(0)
    expect(p.acquire()).toBe(0)
  })

  it('clear() frees everything', () => {
    const p = new Pool(4)
    p.acquire()
    p.acquire()
    p.clear()
    expect(p.count).toBe(0)
    expect(p.isAlive(0)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run test/pool.test.js
```

Expected: FAIL — cannot resolve `../src/core/Pool.js`.

- [ ] **Step 3: Write the implementation**

`src/core/Pool.js`:

```js
/**
 * Fixed-capacity index allocator that keeps live slots in the dense range [0, count).
 *
 * Callers store entity data in their own parallel arrays indexed by the same value.
 * Because release() swaps the last live slot down into the freed one, callers must
 * mirror that swap using `lastSwappedFrom`:
 *
 *   const moved = pool.lastSwappedFrom
 *   if (moved !== -1) copyEntity(moved, freedIndex)
 */
export class Pool {
  constructor(capacity) {
    this.capacity = capacity
    this.count = 0
    this.dropped = 0
    this.lastSwappedFrom = -1
  }

  acquire() {
    if (this.count >= this.capacity) {
      this.dropped++
      return -1
    }
    return this.count++
  }

  release(index) {
    if (index < 0 || index >= this.count) return
    const last = this.count - 1
    this.lastSwappedFrom = index === last ? -1 : last
    this.count--
  }

  isAlive(index) {
    return index >= 0 && index < this.count
  }

  clear() {
    this.count = 0
    this.lastSwappedFrom = -1
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run test/pool.test.js
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/Pool.js test/pool.test.js
git commit -m "feat(core): add fixed-capacity dense index pool"
```

---

### Task 4: `core/SpatialHash.js` — uniform grid broadphase

**Files:**
- Create: `src/core/SpatialHash.js`
- Test: `test/spatialHash.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class SpatialHash { constructor(cellSize: number); clear(): void; insert(id: number, x: number, z: number): void; query(x: number, z: number, radius: number, out: Int32Array|number[]): number /* count written into out */; }`
- `query` writes candidate ids into `out` and returns how many were written. It is a **broadphase**: it may return ids slightly outside `radius` (anything in an overlapping cell) but must never omit an id whose point is within `radius`. Callers do the exact distance check. `out` is caller-owned and reused — no allocation.

- [ ] **Step 1: Write the failing test**

`test/spatialHash.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { SpatialHash } from '../src/core/SpatialHash.js'
import { RNG } from '../src/core/RNG.js'

function bruteForce(points, x, z, radius) {
  const r2 = radius * radius
  const hits = []
  for (let i = 0; i < points.length; i += 2) {
    const dx = points[i] - x
    const dz = points[i + 1] - z
    if (dx * dx + dz * dz <= r2) hits.push(i / 2)
  }
  return hits.sort((a, b) => a - b)
}

describe('SpatialHash', () => {
  it('returns nothing when empty', () => {
    const grid = new SpatialHash(4)
    const out = new Int32Array(64)
    expect(grid.query(0, 0, 10, out)).toBe(0)
  })

  it('finds a point at the query centre', () => {
    const grid = new SpatialHash(4)
    const out = new Int32Array(64)
    grid.insert(7, 1.5, -2.5)
    const n = grid.query(1.5, -2.5, 1, out)
    expect(n).toBe(1)
    expect(out[0]).toBe(7)
  })

  it('never omits a point within the radius (randomised vs brute force)', () => {
    const rng = new RNG(2024)
    const grid = new SpatialHash(4)
    const out = new Int32Array(2048)
    const points = []
    for (let i = 0; i < 800; i++) {
      const x = rng.range(-60, 60)
      const z = rng.range(-60, 60)
      points.push(x, z)
      grid.insert(i, x, z)
    }
    for (let t = 0; t < 200; t++) {
      const qx = rng.range(-60, 60)
      const qz = rng.range(-60, 60)
      const qr = rng.range(0.5, 12)
      const n = grid.query(qx, qz, qr, out)
      const returned = new Set()
      for (let i = 0; i < n; i++) returned.add(out[i])
      for (const id of bruteForce(points, qx, qz, qr)) {
        expect(returned.has(id)).toBe(true)
      }
    }
  })

  it('handles negative coordinates', () => {
    const grid = new SpatialHash(4)
    const out = new Int32Array(64)
    grid.insert(1, -13.2, -41.9)
    expect(grid.query(-13.2, -41.9, 0.5, out)).toBe(1)
    expect(out[0]).toBe(1)
  })

  it('handles a radius spanning many cells', () => {
    const grid = new SpatialHash(2)
    const out = new Int32Array(256)
    for (let i = 0; i < 100; i++) grid.insert(i, i * 0.5 - 25, 0)
    const n = grid.query(0, 0, 30, out)
    expect(n).toBe(100)
  })

  it('clear() empties the grid', () => {
    const grid = new SpatialHash(4)
    const out = new Int32Array(64)
    grid.insert(1, 0, 0)
    grid.clear()
    expect(grid.query(0, 0, 10, out)).toBe(0)
  })

  it('does not overflow the caller-supplied out array', () => {
    const grid = new SpatialHash(4)
    const out = new Int32Array(5)
    for (let i = 0; i < 50; i++) grid.insert(i, 0, 0)
    const n = grid.query(0, 0, 10, out)
    expect(n).toBeLessThanOrEqual(5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run test/spatialHash.test.js
```

Expected: FAIL — cannot resolve `../src/core/SpatialHash.js`.

- [ ] **Step 3: Write the implementation**

`src/core/SpatialHash.js`:

```js
/**
 * Uniform-grid broadphase over the XZ plane.
 *
 * Rebuilt from scratch every tick — at our entity counts that is cheaper than
 * incremental updates and has no stale-key failure mode.
 */
export class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize
    this.inv = 1 / cellSize
    this.cells = new Map()
    this.freeLists = []
  }

  clear() {
    // Recycle the arrays instead of dropping them, so steady state allocates nothing.
    for (const list of this.cells.values()) {
      list.length = 0
      this.freeLists.push(list)
    }
    this.cells.clear()
  }

  _key(cx, cz) {
    // Interleave into a single number. Coordinates are bounded well inside ±2^15
    // for our 70-unit arena, so this is collision-free in practice.
    return (cx + 32768) * 65536 + (cz + 32768)
  }

  insert(id, x, z) {
    const cx = Math.floor(x * this.inv)
    const cz = Math.floor(z * this.inv)
    const key = this._key(cx, cz)
    let list = this.cells.get(key)
    if (list === undefined) {
      list = this.freeLists.pop() ?? []
      this.cells.set(key, list)
    }
    list.push(id)
  }

  query(x, z, radius, out) {
    const minX = Math.floor((x - radius) * this.inv)
    const maxX = Math.floor((x + radius) * this.inv)
    const minZ = Math.floor((z - radius) * this.inv)
    const maxZ = Math.floor((z + radius) * this.inv)
    const cap = out.length
    let n = 0
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const list = this.cells.get(this._key(cx, cz))
        if (list === undefined) continue
        for (let i = 0; i < list.length; i++) {
          if (n >= cap) return n
          out[n++] = list[i]
        }
      }
    }
    return n
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run test/spatialHash.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/SpatialHash.js test/spatialHash.test.js
git commit -m "feat(core): add uniform spatial hash broadphase"
```

---

### Task 5: `core/Time.js`, `core/Events.js`, `core/Input.js`

**Files:**
- Create: `src/core/Time.js`, `src/core/Events.js`, `src/core/Input.js`
- Test: `test/time.test.js`, `test/events.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const FIXED_DT = 1 / 60`
  - `class Clock { constructor(); step(realDt: number): number /* number of fixed ticks to run */; get alpha(): number /* [0,1) render interpolation factor */; reset(): void; }` — clamps `realDt` to `MAX_FRAME = 0.25` to prevent a catch-up spiral, and caps ticks per frame at `MAX_TICKS = 5`.
  - `class Emitter { on(event: string, fn: Function): () => void /* unsubscribe */; off(event, fn): void; emit(event: string, payload?: any): void; clear(): void; }`
  - `class Input { constructor(target: EventTarget); get moveX(): number; get moveZ(): number /* normalized, -1..1 */; get dashPressed(): boolean /* edge-triggered, cleared on read via consumeDash() */; consumeDash(): boolean; consumePause(): boolean; consumeConfirm(): boolean; consumeSlot(): number /* 1..3, or 0 */; dispose(): void; }`

- [ ] **Step 1: Write the failing tests**

`test/time.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { Clock, FIXED_DT } from '../src/core/Time.js'

describe('Clock', () => {
  it('exposes a 60Hz fixed timestep', () => {
    expect(FIXED_DT).toBeCloseTo(1 / 60, 10)
  })

  it('runs one tick for one fixed step of real time', () => {
    const c = new Clock()
    expect(c.step(FIXED_DT)).toBe(1)
  })

  it('accumulates sub-step time instead of dropping it', () => {
    const c = new Clock()
    expect(c.step(FIXED_DT * 0.6)).toBe(0)
    expect(c.step(FIXED_DT * 0.6)).toBe(1)
  })

  it('runs multiple ticks for a long frame', () => {
    const c = new Clock()
    expect(c.step(FIXED_DT * 3)).toBe(3)
  })

  it('clamps a huge frame so it cannot spiral', () => {
    const c = new Clock()
    expect(c.step(10)).toBeLessThanOrEqual(5)
  })

  it('does not bank unbounded time across a stall', () => {
    const c = new Clock()
    c.step(10)
    // After a stall the leftover accumulator must be under one full tick.
    expect(c.step(0)).toBe(0)
  })

  it('reports an alpha in [0, 1)', () => {
    const c = new Clock()
    c.step(FIXED_DT * 1.5)
    expect(c.alpha).toBeGreaterThanOrEqual(0)
    expect(c.alpha).toBeLessThan(1)
  })

  it('reset() clears the accumulator', () => {
    const c = new Clock()
    c.step(FIXED_DT * 0.9)
    c.reset()
    expect(c.step(FIXED_DT * 0.5)).toBe(0)
    expect(c.alpha).toBeCloseTo(0.5, 5)
  })
})
```

`test/events.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { Emitter } from '../src/core/Events.js'

describe('Emitter', () => {
  it('calls listeners with the payload', () => {
    const e = new Emitter()
    const fn = vi.fn()
    e.on('levelUp', fn)
    e.emit('levelUp', { level: 3 })
    expect(fn).toHaveBeenCalledWith({ level: 3 })
  })

  it('supports multiple listeners in registration order', () => {
    const e = new Emitter()
    const calls = []
    e.on('x', () => calls.push('a'))
    e.on('x', () => calls.push('b'))
    e.emit('x')
    expect(calls).toEqual(['a', 'b'])
  })

  it('returns an unsubscribe function', () => {
    const e = new Emitter()
    const fn = vi.fn()
    const off = e.on('x', fn)
    off()
    e.emit('x')
    expect(fn).not.toHaveBeenCalled()
  })

  it('off() removes a specific listener', () => {
    const e = new Emitter()
    const a = vi.fn()
    const b = vi.fn()
    e.on('x', a)
    e.on('x', b)
    e.off('x', a)
    e.emit('x')
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalled()
  })

  it('emitting an unknown event is a no-op', () => {
    const e = new Emitter()
    expect(() => e.emit('nothing')).not.toThrow()
  })

  it('a listener unsubscribing during emit does not skip its neighbour', () => {
    const e = new Emitter()
    const seen = []
    const off = e.on('x', () => { seen.push('a'); off() })
    e.on('x', () => seen.push('b'))
    e.emit('x')
    expect(seen).toEqual(['a', 'b'])
  })

  it('clear() removes everything', () => {
    const e = new Emitter()
    const fn = vi.fn()
    e.on('x', fn)
    e.clear()
    e.emit('x')
    expect(fn).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run test/time.test.js test/events.test.js
```

Expected: FAIL — cannot resolve `../src/core/Time.js` and `../src/core/Events.js`.

- [ ] **Step 3: Write `src/core/Time.js`**

```js
export const FIXED_DT = 1 / 60
const MAX_FRAME = 0.25
const MAX_TICKS = 5

/** Fixed-timestep accumulator. Simulation never sees a variable dt. */
export class Clock {
  constructor() {
    this.accumulator = 0
  }

  /** Feed real elapsed seconds; returns how many fixed ticks to simulate. */
  step(realDt) {
    this.accumulator += Math.min(realDt, MAX_FRAME)
    let ticks = 0
    while (this.accumulator >= FIXED_DT && ticks < MAX_TICKS) {
      this.accumulator -= FIXED_DT
      ticks++
    }
    // If we hit the tick cap, drop the backlog rather than banking it forever.
    if (this.accumulator >= FIXED_DT) this.accumulator = FIXED_DT * 0.999
    return ticks
  }

  /** Fractional progress toward the next tick, for render interpolation. */
  get alpha() {
    return this.accumulator / FIXED_DT
  }

  reset() {
    this.accumulator = 0
  }
}
```

- [ ] **Step 4: Write `src/core/Events.js`**

```js
/** Minimal synchronous event emitter used to decouple UI from simulation. */
export class Emitter {
  constructor() {
    this.map = new Map()
  }

  on(event, fn) {
    let list = this.map.get(event)
    if (list === undefined) {
      list = []
      this.map.set(event, list)
    }
    list.push(fn)
    return () => this.off(event, fn)
  }

  off(event, fn) {
    const list = this.map.get(event)
    if (list === undefined) return
    const i = list.indexOf(fn)
    if (i !== -1) list.splice(i, 1)
  }

  emit(event, payload) {
    const list = this.map.get(event)
    if (list === undefined || list.length === 0) return
    // Iterate a snapshot so a listener may unsubscribe itself mid-emit.
    const snapshot = list.slice()
    for (let i = 0; i < snapshot.length; i++) snapshot[i](payload)
  }

  clear() {
    this.map.clear()
  }
}
```

- [ ] **Step 5: Write `src/core/Input.js`**

Keyboard only. Movement is read as a normalized vector so diagonals are not faster.
Edge-triggered actions are latched and cleared by their `consume*` reader, so a keypress is
never processed twice even if several fixed ticks run in one frame.

```js
const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
}

export class Input {
  constructor(target = window) {
    this.target = target
    this.down = new Set()
    this._dash = false
    this._pause = false
    this._confirm = false
    this._slot = 0

    this._onKeyDown = (e) => {
      if (e.repeat) return
      if (e.code in MOVE_KEYS || e.code === 'Space') e.preventDefault()
      this.down.add(e.code)
      if (e.code === 'Space') this._dash = true
      else if (e.code === 'KeyP' || e.code === 'Escape') this._pause = true
      else if (e.code === 'Enter') this._confirm = true
      else if (e.code === 'Digit1') this._slot = 1
      else if (e.code === 'Digit2') this._slot = 2
      else if (e.code === 'Digit3') this._slot = 3
      else if (e.code === 'F3') { e.preventDefault(); this._debug = true }
    }
    this._onKeyUp = (e) => this.down.delete(e.code)
    this._onBlur = () => this.down.clear()

    target.addEventListener('keydown', this._onKeyDown)
    target.addEventListener('keyup', this._onKeyUp)
    target.addEventListener('blur', this._onBlur)
  }

  get moveX() { return this._axis(0) }
  get moveZ() { return this._axis(1) }

  _axis(component) {
    let x = 0
    let z = 0
    for (const code of this.down) {
      const dir = MOVE_KEYS[code]
      if (dir === undefined) continue
      x += dir[0]
      z += dir[1]
    }
    const len = Math.hypot(x, z)
    if (len === 0) return 0
    return (component === 0 ? x : z) / len
  }

  consumeDash() { const v = this._dash; this._dash = false; return v }
  consumePause() { const v = this._pause; this._pause = false; return v }
  consumeConfirm() { const v = this._confirm; this._confirm = false; return v }
  consumeSlot() { const v = this._slot; this._slot = 0; return v }
  consumeDebug() { const v = this._debug; this._debug = false; return v }

  dispose() {
    this.target.removeEventListener('keydown', this._onKeyDown)
    this.target.removeEventListener('keyup', this._onKeyUp)
    this.target.removeEventListener('blur', this._onBlur)
    this.down.clear()
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx vitest run test/time.test.js test/events.test.js
```

Expected: PASS, 8 + 7 = 15 tests.

- [ ] **Step 7: Commit**

```bash
git add src/core/Time.js src/core/Events.js src/core/Input.js test/time.test.js test/events.test.js
git commit -m "feat(core): add fixed-step clock, event emitter, and keyboard input"
```

---

### Task 6: `data/` balance tables and boot-time validator

**Files:**
- Create: `src/data/characters.js`, `src/data/passives.js`, `src/data/weapons.js`, `src/data/enemies.js`, `src/data/waves.js`, `src/data/realms.js`, `src/data/validate.js`
- Test: `test/waves.test.js`, `test/validate.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all as plain frozen objects/arrays, no logic):
  - `characters.js` → `export const BASE_STATS`, `export const TAGS = ['sword','fire','thunder','ice','array']`, `export const CHARACTERS: Character[]`, `export function getCharacter(id)`
  - `passives.js` → `export const PASSIVES: Passive[]`, `export function getPassive(id)`
  - `weapons.js` → `export const WEAPONS: Weapon[]`, `export const EVOLUTIONS: Weapon[]`, `export function getWeapon(id)` (searches both)
  - `enemies.js` → `export const ENEMIES: Enemy[]`, `export function getEnemy(id)`, `export function scaledHp(enemy, minutes)`, `export function scaledDamage(enemy, minutes)`, `export function scaledXp(enemy, minutes)`
  - `waves.js` → `export const WAVES: Wave[]`, `export const RUN_SECONDS = 900`, `export function waveAt(seconds): Wave`
  - `realms.js` → `export const REALMS`, `export function realmFor(level): {name, hanja}`, `export function xpFor(level): number`
  - `validate.js` → `export function validateData(): void` — throws `Error` with a precise message on any inconsistency.

Types (documented via JSDoc in each file):

```js
/** @typedef {{ id, name, hanja, path, startWeapon, mods: StatMod[] }} Character */
/** @typedef {{ stat: string, op: 'add'|'mul', value: number, tag?: string }} StatMod */
/** @typedef {{ id, name, hanja, desc, max: number, perLevel: StatMod[] }} Passive */
/** @typedef {{ id, name, hanja, tag, desc, pairPassive?: string, evolvesTo?: string, evolutionOf?: string, levels: WeaponLevel[] }} Weapon */
/** @typedef {{ damage, cooldown, amount?, speed?, pierce?, area?, duration?, count?, slow?, burn?, knockback? }} WeaponLevel */
/** @typedef {{ id, name, hanja, hp, speed, damage, radius, kbResist, xp, behavior, color, scale }} Enemy */
/** @typedef {{ t: number, spawnInterval?, perSpawn?, types?: string[], boss?: string }} Wave */
```

- [ ] **Step 1: Write the failing tests**

`test/waves.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { WAVES, RUN_SECONDS, waveAt } from '../src/data/waves.js'
import { ENEMIES } from '../src/data/enemies.js'

const enemyIds = new Set(ENEMIES.map((e) => e.id))

describe('wave timeline', () => {
  it('starts at t=0', () => {
    expect(WAVES[0].t).toBe(0)
  })

  it('is strictly increasing in t', () => {
    for (let i = 1; i < WAVES.length; i++) {
      expect(WAVES[i].t).toBeGreaterThan(WAVES[i - 1].t)
    }
  })

  it('covers the whole 15-minute run', () => {
    expect(RUN_SECONDS).toBe(900)
    expect(WAVES[WAVES.length - 1].t).toBeLessThanOrEqual(RUN_SECONDS)
  })

  it('has no gap larger than 60 seconds', () => {
    for (let i = 1; i < WAVES.length; i++) {
      expect(WAVES[i].t - WAVES[i - 1].t).toBeLessThanOrEqual(60)
    }
  })

  it('only references known enemy ids', () => {
    for (const w of WAVES) {
      for (const id of w.types ?? []) expect(enemyIds.has(id)).toBe(true)
    }
  })

  it('every non-boss wave can actually spawn something', () => {
    for (const w of WAVES) {
      if (w.boss) continue
      expect(w.types.length).toBeGreaterThan(0)
      expect(w.spawnInterval).toBeGreaterThan(0)
      expect(w.perSpawn).toBeGreaterThan(0)
    }
  })

  it('schedules both bosses at the specified times', () => {
    expect(WAVES.find((w) => w.t === 480)?.boss).toBe('blueWolfKing')
    expect(WAVES.find((w) => w.t === 900)?.boss).toBe('darkHeavenLord')
  })

  it('gets harder over time (spawn rate never decreases)', () => {
    const rates = WAVES.filter((w) => w.spawnInterval).map((w) => w.perSpawn / w.spawnInterval)
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1] * 0.9)
    }
  })

  it('waveAt returns the active band', () => {
    expect(waveAt(0).t).toBe(0)
    expect(waveAt(29).t).toBe(0)
    expect(waveAt(899).t).toBeLessThanOrEqual(899)
    expect(waveAt(-5).t).toBe(0)
  })
})
```

`test/validate.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { validateData } from '../src/data/validate.js'
import { WEAPONS, EVOLUTIONS, getWeapon } from '../src/data/weapons.js'
import { PASSIVES } from '../src/data/passives.js'
import { CHARACTERS, TAGS } from '../src/data/characters.js'
import { realmFor, xpFor } from '../src/data/realms.js'

describe('data validation', () => {
  it('passes on the shipped tables', () => {
    expect(() => validateData()).not.toThrow()
  })

  it('ships 8 base weapons and 4 evolutions', () => {
    expect(WEAPONS).toHaveLength(8)
    expect(EVOLUTIONS).toHaveLength(4)
  })

  it('gives every base weapon exactly 5 levels', () => {
    for (const w of WEAPONS) expect(w.levels).toHaveLength(5)
  })

  it('gives every evolution exactly 1 level', () => {
    for (const w of EVOLUTIONS) expect(w.levels).toHaveLength(1)
  })

  it('uses only known tags', () => {
    for (const w of [...WEAPONS, ...EVOLUTIONS]) expect(TAGS).toContain(w.tag)
  })

  it('links evolutions to a real weapon and passive in both directions', () => {
    for (const w of WEAPONS) {
      if (!w.evolvesTo) continue
      const evo = getWeapon(w.evolvesTo)
      expect(evo).toBeDefined()
      expect(evo.evolutionOf).toBe(w.id)
      expect(PASSIVES.some((p) => p.id === w.pairPassive)).toBe(true)
    }
  })

  it('ships 6 passives, all capped at 5', () => {
    expect(PASSIVES).toHaveLength(6)
    for (const p of PASSIVES) expect(p.max).toBe(5)
  })

  it('gives every character a real starting weapon', () => {
    expect(CHARACTERS).toHaveLength(3)
    for (const c of CHARACTERS) expect(getWeapon(c.startWeapon)).toBeDefined()
  })

  it('maps levels to realms without gaps', () => {
    for (let lv = 1; lv <= 40; lv++) {
      expect(realmFor(lv).name).toBeTruthy()
    }
    expect(realmFor(1).name).toBe('연기')
    expect(realmFor(9).name).toBe('축기')
    expect(realmFor(30).name).toBe('대승')
  })

  it('makes each level cost more than the last', () => {
    for (let lv = 1; lv < 40; lv++) {
      expect(xpFor(lv + 1)).toBeGreaterThan(xpFor(lv))
    }
    expect(xpFor(1)).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run test/waves.test.js test/validate.test.js
```

Expected: FAIL — cannot resolve the `src/data/*` modules.

- [ ] **Step 3: Write `src/data/characters.js`**

```js
/** @typedef {{ stat: string, op: 'add'|'mul', value: number, tag?: string }} StatMod */

export const TAGS = ['sword', 'fire', 'thunder', 'ice', 'array']

export const BASE_STATS = Object.freeze({
  maxHp: 100,
  moveSpeed: 5.2,
  armor: 0,
  might: 1.0,
  area: 1.0,
  cooldown: 1.0,
  speedProj: 1.0,
  duration: 1.0,
  amount: 0,
  magnet: 3.0,
  luck: 1.0,
  growth: 1.0,
  critChance: 0.05,
  critMult: 2.0,
  regen: 0,
})

export const CHARACTERS = [
  {
    id: 'seolryeong',
    name: '설령',
    hanja: '雪靈',
    path: '한빙검파 검수',
    desc: '검을 몸의 연장처럼 다루는 한빙검파의 막내 제자.',
    startWeapon: 'flyingSword',
    palette: { hair: 0xdfe9f5, accent: 0x8fd0ff, cloth: 0xf2f7ff, eye: 0x66c2ff },
    mods: [
      { stat: 'moveSpeed', op: 'mul', value: 0.1 },
      { stat: 'tagMight', op: 'add', value: 0.15, tag: 'sword' },
    ],
  },
  {
    id: 'hongryeon',
    name: '홍련',
    hanja: '紅蓮',
    path: '염화종 부법사',
    desc: '부적 한 장으로 산을 태운다는 염화종의 기재.',
    startWeapon: 'fireTalisman',
    palette: { hair: 0x2b1c22, accent: 0xff7a4d, cloth: 0xd94b3a, eye: 0xffb347 },
    mods: [
      { stat: 'area', op: 'add', value: 0.15 },
      { stat: 'tagMight', op: 'add', value: 0.25, tag: 'fire' },
    ],
  },
  {
    id: 'cheongmyo',
    name: '청묘',
    hanja: '靑猫',
    path: '요족 혈맥 체수',
    desc: '요족의 피를 이어받아 맨몸으로 뇌기를 두르는 소녀.',
    startWeapon: 'thunderOrb',
    palette: { hair: 0x2f4f43, accent: 0x9be8c8, cloth: 0xeaf7f0, eye: 0xffd95e },
    mods: [
      { stat: 'maxHp', op: 'mul', value: 0.3 },
      { stat: 'regen', op: 'add', value: 0.4 },
    ],
  },
]

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id)
}
```

- [ ] **Step 4: Write `src/data/passives.js`**

```js
export const PASSIVES = [
  {
    id: 'swordArt', name: '검결', hanja: '劍訣', max: 5,
    desc: '모든 법보의 위력이 오른다.',
    perLevel: [{ stat: 'might', op: 'add', value: 0.1 }],
  },
  {
    id: 'lightBody', name: '경신공', hanja: '輕身功', max: 5,
    desc: '몸이 가벼워져 더 빨리 움직인다.',
    perLevel: [{ stat: 'moveSpeed', op: 'mul', value: 0.08 }],
  },
  {
    id: 'guardianAura', name: '호신강기', hanja: '護身罡氣', max: 5,
    desc: '기혈이 늘고 피해를 흘려낸다.',
    perLevel: [
      { stat: 'maxHp', op: 'mul', value: 0.15 },
      { stat: 'armor', op: 'add', value: 1 },
    ],
  },
  {
    id: 'spiritRoot', name: '영근', hanja: '靈根', max: 5,
    desc: '영기 회전이 빨라져 법보의 재시전이 짧아진다.',
    perLevel: [{ stat: 'cooldown', op: 'add', value: -0.08 }],
  },
  {
    id: 'farSight', name: '천리안', hanja: '千里眼', max: 5,
    desc: '멀리 있는 영기까지 끌어당기고 더 많이 흡수한다.',
    perLevel: [
      { stat: 'magnet', op: 'mul', value: 0.25 },
      { stat: 'growth', op: 'mul', value: 0.1 },
    ],
  },
  {
    id: 'goldenCore', name: '금단', hanja: '金丹', max: 5,
    desc: '단전이 여물어 법보의 범위가 넓어지고 기혈이 회복된다.',
    perLevel: [
      { stat: 'area', op: 'add', value: 0.12 },
      { stat: 'regen', op: 'add', value: 0.3 },
    ],
  },
]

export function getPassive(id) {
  return PASSIVES.find((p) => p.id === id)
}
```

- [ ] **Step 5: Write `src/data/weapons.js`**

Copy the level tables verbatim — these are the balance contract.

```js
export const WEAPONS = [
  {
    id: 'flyingSword', name: '비검', hanja: '飛劍', tag: 'sword',
    desc: '가장 가까운 적을 추적하는 검을 날린다.',
    pairPassive: 'swordArt', evolvesTo: 'myriadSwords',
    levels: [
      { damage: 12, cooldown: 1.10, amount: 1, speed: 18, pierce: 2, area: 1.0, knockback: 2 },
      { damage: 15, cooldown: 1.05, amount: 2, speed: 18, pierce: 2, area: 1.0, knockback: 2 },
      { damage: 18, cooldown: 1.00, amount: 2, speed: 20, pierce: 3, area: 1.1, knockback: 2 },
      { damage: 22, cooldown: 0.90, amount: 3, speed: 20, pierce: 3, area: 1.1, knockback: 3 },
      { damage: 28, cooldown: 0.80, amount: 4, speed: 22, pierce: 4, area: 1.2, knockback: 3 },
    ],
  },
  {
    id: 'fireTalisman', name: '화염부', hanja: '火焰符', tag: 'fire',
    desc: '적에게 부적을 던져 터뜨리고 화상을 남긴다.',
    pairPassive: 'goldenCore', evolvesTo: 'infernoSea',
    levels: [
      { damage: 16, cooldown: 1.60, amount: 1, speed: 12, area: 1.0, burn: 4, duration: 3 },
      { damage: 20, cooldown: 1.50, amount: 1, speed: 12, area: 1.15, burn: 5, duration: 3 },
      { damage: 24, cooldown: 1.40, amount: 2, speed: 13, area: 1.25, burn: 6, duration: 3.5 },
      { damage: 30, cooldown: 1.30, amount: 2, speed: 13, area: 1.4, burn: 8, duration: 4 },
      { damage: 38, cooldown: 1.15, amount: 3, speed: 14, area: 1.6, burn: 10, duration: 4 },
    ],
  },
  {
    id: 'thunderOrb', name: '뇌령주', hanja: '雷靈珠', tag: 'thunder',
    desc: '몸 주위를 도는 뇌기 구슬이 닿는 적을 지진다.',
    pairPassive: 'spiritRoot', evolvesTo: 'violetThunder',
    levels: [
      { damage: 10, cooldown: 0.45, count: 2, area: 1.0, speed: 2.2, knockback: 2 },
      { damage: 13, cooldown: 0.45, count: 3, area: 1.0, speed: 2.4, knockback: 2 },
      { damage: 16, cooldown: 0.40, count: 4, area: 1.1, speed: 2.6, knockback: 2 },
      { damage: 20, cooldown: 0.40, count: 5, area: 1.2, speed: 2.8, knockback: 3 },
      { damage: 26, cooldown: 0.35, count: 6, area: 1.3, speed: 3.0, knockback: 3 },
    ],
  },
  {
    id: 'frostPalm', name: '빙백장', hanja: '氷魄掌', tag: 'ice',
    desc: '진행 방향으로 냉기를 뿜어 적을 얼려 붙인다.',
    pairPassive: 'guardianAura', evolvesTo: 'frozenSky',
    levels: [
      { damage: 14, cooldown: 2.20, area: 1.0, slow: 0.4, duration: 2, knockback: 4 },
      { damage: 18, cooldown: 2.10, area: 1.15, slow: 0.4, duration: 2, knockback: 4 },
      { damage: 23, cooldown: 2.00, area: 1.3, slow: 0.45, duration: 2.5, knockback: 5 },
      { damage: 29, cooldown: 1.85, area: 1.45, slow: 0.5, duration: 2.5, knockback: 5 },
      { damage: 38, cooldown: 1.70, area: 1.65, slow: 0.55, duration: 3, knockback: 6 },
    ],
  },
  {
    id: 'baguaArray', name: '팔괘진', hanja: '八卦陣', tag: 'array',
    desc: '발밑에 진법을 펼쳐 범위 안의 적을 지속적으로 태운다.',
    levels: [
      { damage: 5, cooldown: 0.50, area: 1.0 },
      { damage: 6, cooldown: 0.48, area: 1.2 },
      { damage: 8, cooldown: 0.45, area: 1.4 },
      { damage: 10, cooldown: 0.42, area: 1.6 },
      { damage: 13, cooldown: 0.38, area: 1.9 },
    ],
  },
  {
    id: 'vajra', name: '금강저', hanja: '金剛杵', tag: 'array',
    desc: '정면으로 금강저를 쏘아 모든 것을 꿰뚫고 밀어낸다.',
    levels: [
      { damage: 30, cooldown: 2.40, amount: 1, speed: 14, pierce: 999, area: 1.0, knockback: 10 },
      { damage: 38, cooldown: 2.30, amount: 1, speed: 15, pierce: 999, area: 1.15, knockback: 11 },
      { damage: 46, cooldown: 2.15, amount: 2, speed: 15, pierce: 999, area: 1.25, knockback: 12 },
      { damage: 58, cooldown: 2.00, amount: 2, speed: 16, pierce: 999, area: 1.4, knockback: 13 },
      { damage: 74, cooldown: 1.85, amount: 3, speed: 17, pierce: 999, area: 1.6, knockback: 15 },
    ],
  },
  {
    id: 'spiritButterfly', name: '영접부', hanja: '靈蝶符', tag: 'array',
    desc: '느리게 떠도는 영접이 적을 찾아 달라붙는다.',
    levels: [
      { damage: 7, cooldown: 1.80, amount: 3, speed: 5, pierce: 1, area: 1.0, duration: 6 },
      { damage: 9, cooldown: 1.70, amount: 4, speed: 5, pierce: 1, area: 1.0, duration: 6 },
      { damage: 11, cooldown: 1.60, amount: 6, speed: 5.5, pierce: 2, area: 1.1, duration: 7 },
      { damage: 14, cooldown: 1.50, amount: 8, speed: 5.5, pierce: 2, area: 1.1, duration: 7 },
      { damage: 18, cooldown: 1.35, amount: 10, speed: 6, pierce: 3, area: 1.2, duration: 8 },
    ],
  },
  {
    id: 'skyThunder', name: '천뢰인', hanja: '天雷引', tag: 'thunder',
    desc: '하늘에서 벼락을 끌어내려 적을 내리친다.',
    levels: [
      { damage: 34, cooldown: 3.00, amount: 1, area: 1.0, knockback: 4 },
      { damage: 42, cooldown: 2.80, amount: 2, area: 1.1, knockback: 4 },
      { damage: 52, cooldown: 2.60, amount: 3, area: 1.2, knockback: 5 },
      { damage: 64, cooldown: 2.35, amount: 4, area: 1.3, knockback: 5 },
      { damage: 82, cooldown: 2.10, amount: 6, area: 1.5, knockback: 6 },
    ],
  },
]

export const EVOLUTIONS = [
  {
    id: 'myriadSwords', name: '만검귀종', hanja: '萬劍歸宗', tag: 'sword',
    desc: '하늘의 모든 검이 그대에게 돌아온다. 끊임없이 검비가 쏟아진다.',
    evolutionOf: 'flyingSword',
    levels: [{ damage: 34, cooldown: 0.22, amount: 2, speed: 26, pierce: 3, area: 1.6, knockback: 3 }],
  },
  {
    id: 'infernoSea', name: '분천화해', hanja: '焚天火海', tag: 'fire',
    desc: '터진 자리에 불바다가 남아 계속 타오른다.',
    evolutionOf: 'fireTalisman',
    levels: [{ damage: 44, cooldown: 0.95, amount: 3, speed: 14, area: 1.9, burn: 14, duration: 5 }],
  },
  {
    id: 'violetThunder', name: '자소신뢰', hanja: '紫霄神雷', tag: 'thunder',
    desc: '구슬에서 뻗은 뇌전이 주변의 적으로 연쇄한다.',
    evolutionOf: 'thunderOrb',
    levels: [{ damage: 32, cooldown: 0.30, count: 7, area: 1.5, speed: 3.4, knockback: 4, chain: 2, chainRange: 6 }],
  },
  {
    id: 'frozenSky', name: '한천빙봉', hanja: '寒天氷封', tag: 'ice',
    desc: '적을 완전히 얼려붙이고, 부서질 때 냉기가 터진다.',
    evolutionOf: 'frostPalm',
    levels: [{ damage: 52, cooldown: 1.40, area: 2.0, slow: 0.95, duration: 3, knockback: 7, shatter: 40 }],
  },
]

const ALL = [...WEAPONS, ...EVOLUTIONS]

export function getWeapon(id) {
  return ALL.find((w) => w.id === id)
}
```

- [ ] **Step 6: Write `src/data/enemies.js`**

```js
export const ENEMIES = [
  { id: 'wisp', name: '마기 잔영', hanja: '魔氣殘影', hp: 8, speed: 2.4, damage: 6,
    radius: 0.45, kbResist: 0.0, xp: 1, behavior: 'chase', color: 0x8b6fd6, scale: 0.9 },
  { id: 'wolf', name: '요랑', hanja: '妖狼', hp: 16, speed: 4.6, damage: 10,
    radius: 0.55, kbResist: 0.1, xp: 2, behavior: 'dasher', color: 0x5f7fa8, scale: 1.0 },
  { id: 'stoneGhoul', name: '석귀', hanja: '石鬼', hp: 90, speed: 1.5, damage: 18,
    radius: 0.95, kbResist: 0.7, xp: 5, behavior: 'chase', color: 0x7d7466, scale: 1.7 },
  { id: 'talismanGhost', name: '부적귀', hanja: '符鬼', hp: 22, speed: 2.0, damage: 8,
    radius: 0.55, kbResist: 0.2, xp: 3, behavior: 'ranged', color: 0xc7b56a, scale: 1.0,
    shootInterval: 2.5, keepDistance: 10, shotSpeed: 9, shotDamage: 8 },
  { id: 'bloodScorpion', name: '혈갈', hanja: '血蝎', hp: 34, speed: 3.0, damage: 12,
    radius: 0.7, kbResist: 0.3, xp: 4, behavior: 'splitter', color: 0xa3324a, scale: 1.2,
    splitInto: 2 },
  { id: 'demonCultivator', name: '마수사', hanja: '魔修士', hp: 160, speed: 3.4, damage: 22,
    radius: 0.85, kbResist: 0.5, xp: 15, behavior: 'dasher', color: 0x6b3fa0, scale: 1.4,
    elite: true, dashInterval: 4 },
]

export function getEnemy(id) {
  return ENEMIES.find((e) => e.id === id)
}

/** Enemies get tougher as the run goes on; speed deliberately does not scale. */
export function scaledHp(enemy, minutes) {
  return enemy.hp * (1 + minutes * 0.28 + (minutes / 6) ** 2)
}

export function scaledDamage(enemy, minutes) {
  return enemy.damage * (1 + minutes * 0.06)
}

export function scaledXp(enemy, minutes) {
  return Math.ceil(enemy.xp * (1 + minutes * 0.05))
}
```

- [ ] **Step 7: Write `src/data/waves.js`**

One band per 30 seconds from 0:00 to 15:00. Spawn pressure rises monotonically.

```js
export const RUN_SECONDS = 900

export const WAVES = [
  { t: 0,   spawnInterval: 1.30, perSpawn: 3,  types: ['wisp'] },
  { t: 30,  spawnInterval: 1.25, perSpawn: 3,  types: ['wisp'] },
  { t: 60,  spawnInterval: 1.20, perSpawn: 4,  types: ['wisp', 'wolf'] },
  { t: 90,  spawnInterval: 1.15, perSpawn: 4,  types: ['wisp', 'wolf'] },
  { t: 120, spawnInterval: 1.10, perSpawn: 5,  types: ['wisp', 'wolf'] },
  { t: 150, spawnInterval: 1.05, perSpawn: 5,  types: ['wisp', 'wolf', 'stoneGhoul'] },
  { t: 180, spawnInterval: 1.00, perSpawn: 6,  types: ['wisp', 'wolf', 'stoneGhoul'] },
  { t: 210, spawnInterval: 0.95, perSpawn: 6,  types: ['wolf', 'stoneGhoul', 'talismanGhost'] },
  { t: 240, spawnInterval: 0.92, perSpawn: 7,  types: ['wisp', 'wolf', 'talismanGhost'] },
  { t: 270, spawnInterval: 0.90, perSpawn: 7,  types: ['wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 300, spawnInterval: 0.88, perSpawn: 8,  types: ['wisp', 'wolf', 'bloodScorpion'] },
  { t: 330, spawnInterval: 0.85, perSpawn: 8,  types: ['wolf', 'stoneGhoul', 'bloodScorpion'] },
  { t: 360, spawnInterval: 0.82, perSpawn: 9,  types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 390, spawnInterval: 0.80, perSpawn: 9,  types: ['wolf', 'stoneGhoul', 'talismanGhost'] },
  { t: 420, spawnInterval: 0.78, perSpawn: 10, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
  { t: 450, spawnInterval: 0.75, perSpawn: 10, types: ['wolf', 'stoneGhoul', 'demonCultivator'] },
  { t: 480, boss: 'blueWolfKing', spawnInterval: 1.60, perSpawn: 4, types: ['wolf'] },
  { t: 510, spawnInterval: 0.72, perSpawn: 11, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 540, spawnInterval: 0.70, perSpawn: 11, types: ['wolf', 'stoneGhoul', 'bloodScorpion'] },
  { t: 570, spawnInterval: 0.68, perSpawn: 12, types: ['wisp', 'wolf', 'talismanGhost', 'demonCultivator'] },
  { t: 600, spawnInterval: 0.65, perSpawn: 12, types: ['wolf', 'stoneGhoul', 'bloodScorpion', 'demonCultivator'] },
  { t: 630, spawnInterval: 0.63, perSpawn: 13, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 660, spawnInterval: 0.60, perSpawn: 13, types: ['wolf', 'stoneGhoul', 'demonCultivator'] },
  { t: 690, spawnInterval: 0.58, perSpawn: 14, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
  { t: 720, spawnInterval: 0.55, perSpawn: 14, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'bloodScorpion'] },
  { t: 750, spawnInterval: 0.52, perSpawn: 15, types: ['wisp', 'wolf', 'stoneGhoul', 'demonCultivator'] },
  { t: 780, spawnInterval: 0.50, perSpawn: 16, types: ['wolf', 'talismanGhost', 'bloodScorpion', 'demonCultivator'] },
  { t: 810, spawnInterval: 0.48, perSpawn: 17, types: ['wisp', 'wolf', 'stoneGhoul', 'bloodScorpion'] },
  { t: 840, spawnInterval: 0.45, perSpawn: 18, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'demonCultivator'] },
  { t: 870, spawnInterval: 0.42, perSpawn: 20, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
  { t: 900, boss: 'darkHeavenLord', spawnInterval: 2.00, perSpawn: 4, types: ['wisp', 'demonCultivator'] },
]

/** The wave band active at a given run time, clamped at both ends. */
export function waveAt(seconds) {
  const t = Math.max(0, seconds)
  let found = WAVES[0]
  for (let i = 0; i < WAVES.length; i++) {
    if (WAVES[i].t <= t) found = WAVES[i]
    else break
  }
  return found
}
```

- [ ] **Step 8: Write `src/data/realms.js`**

```js
export const REALMS = [
  { minLevel: 1,  name: '연기', hanja: '練氣' },
  { minLevel: 5,  name: '축기', hanja: '築基' },
  { minLevel: 10, name: '결단', hanja: '結丹' },
  { minLevel: 15, name: '원영', hanja: '元嬰' },
  { minLevel: 20, name: '화신', hanja: '化神' },
  { minLevel: 25, name: '연허', hanja: '煉虛' },
  { minLevel: 30, name: '대승', hanja: '大乘' },
]

export function realmFor(level) {
  let found = REALMS[0]
  for (const r of REALMS) {
    if (level >= r.minLevel) found = r
    else break
  }
  return found
}

/** XP needed to go from `level` to `level + 1`. */
export function xpFor(level) {
  return Math.floor(5 + level * 8 + level ** 1.55 * 2.4)
}
```

- [ ] **Step 9: Write `src/data/validate.js`**

```js
import { CHARACTERS, TAGS, BASE_STATS } from './characters.js'
import { PASSIVES } from './passives.js'
import { WEAPONS, EVOLUTIONS, getWeapon } from './weapons.js'
import { ENEMIES } from './enemies.js'
import { WAVES, RUN_SECONDS } from './waves.js'

function fail(message) {
  throw new Error(`[data] ${message}`)
}

/**
 * Boot-time consistency check over the balance tables.
 * Runs in dev only; a bad table should fail loudly at startup, not mid-run.
 */
export function validateData() {
  const passiveIds = new Set(PASSIVES.map((p) => p.id))
  const enemyIds = new Set(ENEMIES.map((e) => e.id))
  const statNames = new Set([...Object.keys(BASE_STATS), 'tagMight'])

  const seen = new Set()
  for (const w of [...WEAPONS, ...EVOLUTIONS]) {
    if (seen.has(w.id)) fail(`duplicate weapon id "${w.id}"`)
    seen.add(w.id)
    if (!TAGS.includes(w.tag)) fail(`weapon "${w.id}" has unknown tag "${w.tag}"`)
    if (!Array.isArray(w.levels) || w.levels.length === 0) fail(`weapon "${w.id}" has no levels`)
    for (const [i, lv] of w.levels.entries()) {
      if (typeof lv.damage !== 'number') fail(`weapon "${w.id}" level ${i + 1} is missing damage`)
      if (typeof lv.cooldown !== 'number' || lv.cooldown <= 0) {
        fail(`weapon "${w.id}" level ${i + 1} has an invalid cooldown`)
      }
    }
  }

  for (const w of WEAPONS) {
    if (w.levels.length !== 5) fail(`base weapon "${w.id}" must have 5 levels, has ${w.levels.length}`)
    if (!w.evolvesTo) continue
    if (!w.pairPassive) fail(`weapon "${w.id}" evolves but has no pairPassive`)
    if (!passiveIds.has(w.pairPassive)) fail(`weapon "${w.id}" pairs with unknown passive "${w.pairPassive}"`)
    const evo = getWeapon(w.evolvesTo)
    if (!evo) fail(`weapon "${w.id}" evolves into unknown weapon "${w.evolvesTo}"`)
    if (evo.evolutionOf !== w.id) fail(`evolution "${evo.id}" does not point back at "${w.id}"`)
  }

  for (const e of EVOLUTIONS) {
    if (e.levels.length !== 1) fail(`evolution "${e.id}" must have exactly 1 level`)
    if (!getWeapon(e.evolutionOf)) fail(`evolution "${e.id}" comes from unknown weapon "${e.evolutionOf}"`)
  }

  for (const p of PASSIVES) {
    if (p.max !== 5) fail(`passive "${p.id}" must cap at 5`)
    for (const m of p.perLevel) {
      if (!statNames.has(m.stat)) fail(`passive "${p.id}" modifies unknown stat "${m.stat}"`)
      if (m.op !== 'add' && m.op !== 'mul') fail(`passive "${p.id}" uses unknown op "${m.op}"`)
    }
  }

  for (const c of CHARACTERS) {
    if (!getWeapon(c.startWeapon)) fail(`character "${c.id}" starts with unknown weapon "${c.startWeapon}"`)
    for (const m of c.mods) {
      if (!statNames.has(m.stat)) fail(`character "${c.id}" modifies unknown stat "${m.stat}"`)
      if (m.stat === 'tagMight' && !TAGS.includes(m.tag)) {
        fail(`character "${c.id}" targets unknown tag "${m.tag}"`)
      }
    }
  }

  if (WAVES[0].t !== 0) fail('wave timeline must start at t=0')
  for (let i = 1; i < WAVES.length; i++) {
    if (WAVES[i].t <= WAVES[i - 1].t) fail(`wave timeline is not increasing at index ${i}`)
    if (WAVES[i].t - WAVES[i - 1].t > 60) fail(`wave timeline has a gap before t=${WAVES[i].t}`)
  }
  if (WAVES[WAVES.length - 1].t > RUN_SECONDS) fail('wave timeline runs past the end of the run')
  for (const w of WAVES) {
    for (const id of w.types ?? []) {
      if (!enemyIds.has(id)) fail(`wave at t=${w.t} references unknown enemy "${id}"`)
    }
  }
}
```

- [ ] **Step 10: Run the tests to verify they pass**

```bash
npx vitest run test/waves.test.js test/validate.test.js
```

Expected: PASS, 9 + 11 = 20 tests.

- [ ] **Step 11: Commit**

```bash
git add src/data test/waves.test.js test/validate.test.js
git commit -m "feat(data): add balance tables for characters, weapons, passives, enemies, waves, realms"
```

---

### Task 7: `combat/Stats.js` — stat aggregation

**Files:**
- Create: `src/combat/Stats.js`
- Test: `test/stats.test.js`

**Interfaces:**
- Consumes: `data/characters.js` (`BASE_STATS`, `TAGS`), `data/passives.js` (`getPassive`).
- Produces:
  - `export function computeStats(character, passiveLevels: Record<string, number>): Stats` — pure; rebuilds from base every call.
  - `Stats` is a plain object with every key of `BASE_STATS` plus `tagMight: Record<tag, number>`.
  - `export const COOLDOWN_FLOOR = 0.4`
  - `export function applyMaxHpChange(currentHp, oldMax, newMax): number` — preserves the HP fraction.

Rule table (from the spec):
- **additive:** `might`, `area`, `armor`, `regen`, `amount`, `critChance`, `critMult`, `cooldown`
- **multiplicative:** `moveSpeed`, `maxHp`, `magnet`, `growth`, `speedProj`, `duration`, `luck`
- `cooldown` is clamped to a floor of `COOLDOWN_FLOOR`.

Note the mods themselves carry `op`, so `computeStats` simply honours each mod's `op`; the
table above documents which `op` each shipped mod uses and is what the tests pin down.

- [ ] **Step 1: Write the failing test**

`test/stats.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { computeStats, applyMaxHpChange, COOLDOWN_FLOOR } from '../src/combat/Stats.js'
import { BASE_STATS, getCharacter } from '../src/data/characters.js'

const plain = { id: 'test', name: 't', startWeapon: 'flyingSword', mods: [] }

describe('computeStats', () => {
  it('returns base stats for a character with no mods and no passives', () => {
    const s = computeStats(plain, {})
    for (const key of Object.keys(BASE_STATS)) expect(s[key]).toBe(BASE_STATS[key])
  })

  it('starts every tag at zero bonus', () => {
    const s = computeStats(plain, {})
    expect(s.tagMight.sword).toBe(0)
    expect(s.tagMight.fire).toBe(0)
  })

  it('adds additive stats linearly', () => {
    const s = computeStats(plain, { swordArt: 3 })
    expect(s.might).toBeCloseTo(1.0 + 0.3, 6)
  })

  it('applies multiplicative stats as a product', () => {
    const s = computeStats(plain, { lightBody: 2 })
    expect(s.moveSpeed).toBeCloseTo(BASE_STATS.moveSpeed * 1.16, 6)
  })

  it('stacks a character mod with a passive on the same stat', () => {
    const seolryeong = getCharacter('seolryeong')
    const s = computeStats(seolryeong, { lightBody: 1 })
    expect(s.moveSpeed).toBeCloseTo(BASE_STATS.moveSpeed * 1.1 * 1.08, 6)
  })

  it('routes tagMight mods to the right tag only', () => {
    const s = computeStats(getCharacter('seolryeong'), {})
    expect(s.tagMight.sword).toBeCloseTo(0.15, 6)
    expect(s.tagMight.fire).toBe(0)
  })

  it('reduces cooldown additively', () => {
    const s = computeStats(plain, { spiritRoot: 3 })
    expect(s.cooldown).toBeCloseTo(1.0 - 0.24, 6)
  })

  it('clamps cooldown at the floor', () => {
    const s = computeStats(plain, { spiritRoot: 5 })
    // 5 levels is -0.40, exactly at the floor; verify it never goes below.
    expect(s.cooldown).toBeGreaterThanOrEqual(COOLDOWN_FLOOR)
  })

  it('applies both mods of a multi-mod passive', () => {
    const s = computeStats(plain, { guardianAura: 2 })
    expect(s.maxHp).toBeCloseTo(BASE_STATS.maxHp * 1.15 * 1.15, 4)
    expect(s.armor).toBe(2)
  })

  it('ignores passives at level 0', () => {
    const s = computeStats(plain, { swordArt: 0 })
    expect(s.might).toBe(BASE_STATS.might)
  })

  it('is pure — repeated calls give identical results', () => {
    const a = computeStats(getCharacter('cheongmyo'), { goldenCore: 4 })
    const b = computeStats(getCharacter('cheongmyo'), { goldenCore: 4 })
    expect(a).toEqual(b)
  })
})

describe('applyMaxHpChange', () => {
  it('preserves the HP fraction when max HP rises', () => {
    expect(applyMaxHpChange(50, 100, 200)).toBe(100)
  })

  it('preserves the HP fraction when max HP falls', () => {
    expect(applyMaxHpChange(80, 100, 50)).toBe(40)
  })

  it('keeps a full-health character at full health', () => {
    expect(applyMaxHpChange(100, 100, 130)).toBe(130)
  })

  it('is a no-op when the old max is zero', () => {
    expect(applyMaxHpChange(0, 0, 100)).toBe(100)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run test/stats.test.js
```

Expected: FAIL — cannot resolve `../src/combat/Stats.js`.

- [ ] **Step 3: Write the implementation**

`src/combat/Stats.js`:

```js
import { BASE_STATS, TAGS } from '../data/characters.js'
import { getPassive } from '../data/passives.js'

export const COOLDOWN_FLOOR = 0.4

/**
 * Rebuild the full stat block from scratch.
 *
 * Always recomputed from base — never patched incrementally — so a bad
 * increment can never drift the numbers over a long run.
 *
 * value = (base + Σ add) * Π (1 + mul)
 */
export function computeStats(character, passiveLevels) {
  const adds = {}
  const muls = {}
  const tagMight = {}
  for (const tag of TAGS) tagMight[tag] = 0

  const apply = (mod) => {
    if (mod.stat === 'tagMight') {
      tagMight[mod.tag] += mod.value
      return
    }
    if (mod.op === 'add') adds[mod.stat] = (adds[mod.stat] ?? 0) + mod.value
    else muls[mod.stat] = (muls[mod.stat] ?? 1) * (1 + mod.value)
  }

  for (const mod of character.mods ?? []) apply(mod)

  for (const [id, level] of Object.entries(passiveLevels ?? {})) {
    if (!level) continue
    const passive = getPassive(id)
    if (passive === undefined) continue
    for (let i = 0; i < level; i++) {
      for (const mod of passive.perLevel) apply(mod)
    }
  }

  const out = { tagMight }
  for (const [key, base] of Object.entries(BASE_STATS)) {
    out[key] = (base + (adds[key] ?? 0)) * (muls[key] ?? 1)
  }
  if (out.cooldown < COOLDOWN_FLOOR) out.cooldown = COOLDOWN_FLOOR
  return out
}

/** Keep the player at the same health fraction when their max HP changes. */
export function applyMaxHpChange(currentHp, oldMax, newMax) {
  if (oldMax <= 0) return newMax
  return (currentHp / oldMax) * newMax
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run test/stats.test.js
```

Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/combat/Stats.js test/stats.test.js
git commit -m "feat(combat): add stat aggregation with additive/multiplicative rules"
```

---

### Task 8: `combat/damage.js` — damage resolution math

**Files:**
- Create: `src/combat/damage.js`
- Test: `test/damage.test.js`

**Interfaces:**
- Consumes: `core/RNG.js`.
- Produces:
  - `export function rollDamage(rawDamage, stats, tag, rng): { amount: number, crit: boolean }` — pure math, no side effects, so it is unit-testable without a world.
  - `export function knockbackImpulse(force, kbResist): number`
  - `export function mitigate(rawDamage, armor): number` — incoming player damage after flat armor, floored at 1.

The stateful part (`applyDamage`, which mutates an enemy, emits floating text and triggers
death) lives in `entities/EnemyManager.js` where the enemy arrays are; it calls these three
pure helpers. This keeps the math testable and the mutation local to its data.

- [ ] **Step 1: Write the failing test**

`test/damage.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { rollDamage, knockbackImpulse, mitigate } from '../src/combat/damage.js'
import { RNG } from '../src/core/RNG.js'

const stats = (over = {}) => ({
  might: 1, critChance: 0, critMult: 2,
  tagMight: { sword: 0, fire: 0, thunder: 0, ice: 0, array: 0 },
  ...over,
})

describe('rollDamage', () => {
  it('returns the raw damage at base stats with no crit', () => {
    const r = rollDamage(20, stats(), 'sword', new RNG(1))
    expect(r.amount).toBe(20)
    expect(r.crit).toBe(false)
  })

  it('scales with might', () => {
    expect(rollDamage(20, stats({ might: 1.5 }), 'sword', new RNG(1)).amount).toBe(30)
  })

  it('adds the matching tag bonus on top of might', () => {
    const s = stats({ might: 1.0, tagMight: { sword: 0.5, fire: 0, thunder: 0, ice: 0, array: 0 } })
    expect(rollDamage(20, s, 'sword', new RNG(1)).amount).toBe(30)
  })

  it('ignores a tag bonus for a different tag', () => {
    const s = stats({ tagMight: { sword: 0.5, fire: 0, thunder: 0, ice: 0, array: 0 } })
    expect(rollDamage(20, s, 'fire', new RNG(1)).amount).toBe(20)
  })

  it('multiplies by critMult on a crit', () => {
    const r = rollDamage(20, stats({ critChance: 1, critMult: 3 }), 'sword', new RNG(1))
    expect(r.crit).toBe(true)
    expect(r.amount).toBe(60)
  })

  it('rounds to a whole number', () => {
    expect(Number.isInteger(rollDamage(7, stats({ might: 1.13 }), 'sword', new RNG(1)).amount)).toBe(true)
  })

  it('never deals less than 1', () => {
    expect(rollDamage(0.01, stats({ might: 0.01 }), 'sword', new RNG(1)).amount).toBe(1)
  })

  it('is deterministic for a given seed', () => {
    const s = stats({ critChance: 0.5 })
    const a = Array.from({ length: 20 }, (_, i) => rollDamage(10, s, 'sword', new RNG(99)).crit)
    const b = Array.from({ length: 20 }, (_, i) => rollDamage(10, s, 'sword', new RNG(99)).crit)
    expect(a).toEqual(b)
  })

  it('handles an unknown tag as zero bonus', () => {
    expect(rollDamage(20, stats(), 'nonexistent', new RNG(1)).amount).toBe(20)
  })
})

describe('knockbackImpulse', () => {
  it('passes force through at zero resist', () => {
    expect(knockbackImpulse(10, 0)).toBe(10)
  })

  it('scales down with resist', () => {
    expect(knockbackImpulse(10, 0.7)).toBeCloseTo(3, 6)
  })

  it('is zero at full resist', () => {
    expect(knockbackImpulse(10, 1)).toBe(0)
  })

  it('never goes negative for over-unity resist', () => {
    expect(knockbackImpulse(10, 1.5)).toBe(0)
  })
})

describe('mitigate', () => {
  it('subtracts flat armor', () => {
    expect(mitigate(10, 3)).toBe(7)
  })

  it('floors at 1 damage', () => {
    expect(mitigate(4, 99)).toBe(1)
  })

  it('is a no-op at zero armor', () => {
    expect(mitigate(12, 0)).toBe(12)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run test/damage.test.js
```

Expected: FAIL — cannot resolve `../src/combat/damage.js`.

- [ ] **Step 3: Write the implementation**

`src/combat/damage.js`:

```js
/**
 * Pure damage math. No world state, no side effects — everything here is
 * unit-testable in isolation. The mutating side (applying HP loss, spawning
 * floating text, triggering death) lives with the enemy arrays in EnemyManager.
 */

/** Roll one hit: might + tag bonus, then a crit check. */
export function rollDamage(rawDamage, stats, tag, rng) {
  const tagBonus = stats.tagMight?.[tag] ?? 0
  let amount = rawDamage * (stats.might + tagBonus)
  const crit = rng.chance(stats.critChance)
  if (crit) amount *= stats.critMult
  return { amount: Math.max(1, Math.round(amount)), crit }
}

/** Knockback force after the target's resistance. */
export function knockbackImpulse(force, kbResist) {
  return Math.max(0, force * (1 - kbResist))
}

/** Incoming damage to the player after flat armor, floored at 1. */
export function mitigate(rawDamage, armor) {
  return Math.max(1, rawDamage - armor)
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run test/damage.test.js
```

Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/combat/damage.js test/damage.test.js
git commit -m "feat(combat): add pure damage, knockback, and mitigation math"
```

---

### Task 9: `combat/upgrades.js` — level-up choice roll

**Files:**
- Create: `src/combat/upgrades.js`
- Test: `test/upgrades.test.js`

**Interfaces:**
- Consumes: `data/weapons.js`, `data/passives.js`, `core/RNG.js`.
- Produces:
  - `export const MAX_WEAPON_SLOTS = 6`, `export const MAX_PASSIVE_SLOTS = 6`
  - `export const CONSUMABLES: {id, name, hanja, desc, kind: 'consumable'}[]`
  - `export function rollUpgrades(loadout, stats, rng, count = 3): Choice[]`
  - `Loadout` = `{ weapons: Record<string, number>, passives: Record<string, number> }` (id → level).
  - `Choice` = `{ kind: 'weapon'|'passive'|'evolution'|'consumable', id, name, hanja, desc, fromLevel, toLevel }`
  - `export function applyChoice(loadout, choice): void` — mutates the loadout in place; an evolution deletes the base weapon and inserts the evolved one at level 1.
  - `export function canEvolve(loadout, weapon): boolean`

Weights from the spec: owned weapon < max → 100, owned passive < max → 80, new weapon → 60,
new passive → 50, available evolution → 400. Multiplied by `stats.luck`. Drawn without
replacement. Falls back to consumables when the pool is empty.

- [ ] **Step 1: Write the failing test**

`test/upgrades.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  rollUpgrades, applyChoice, canEvolve,
  MAX_WEAPON_SLOTS, MAX_PASSIVE_SLOTS,
} from '../src/combat/upgrades.js'
import { WEAPONS, EVOLUTIONS } from '../src/data/weapons.js'
import { PASSIVES } from '../src/data/passives.js'
import { RNG } from '../src/core/RNG.js'

const stats = { luck: 1 }
const loadout = (weapons = {}, passives = {}) => ({ weapons: { ...weapons }, passives: { ...passives } })

describe('rollUpgrades', () => {
  it('offers exactly three choices', () => {
    expect(rollUpgrades(loadout({ flyingSword: 1 }), stats, new RNG(1))).toHaveLength(3)
  })

  it('offers distinct choices', () => {
    for (let seed = 0; seed < 50; seed++) {
      const ids = rollUpgrades(loadout({ flyingSword: 1 }), stats, new RNG(seed)).map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('never offers a weapon that is already at max level', () => {
    const lo = loadout({ flyingSword: 5 })
    for (let seed = 0; seed < 100; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed))) {
        if (c.kind === 'weapon') expect(c.id).not.toBe('flyingSword')
      }
    }
  })

  it('never offers a passive that is already at max level', () => {
    const lo = loadout({ flyingSword: 1 }, { swordArt: 5 })
    for (let seed = 0; seed < 100; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed))) {
        if (c.kind === 'passive') expect(c.id).not.toBe('swordArt')
      }
    }
  })

  it('never offers a new weapon once the weapon slots are full', () => {
    const weapons = {}
    for (const w of WEAPONS.slice(0, MAX_WEAPON_SLOTS)) weapons[w.id] = 1
    const lo = loadout(weapons)
    const ownedIds = new Set(Object.keys(weapons))
    for (let seed = 0; seed < 100; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed))) {
        if (c.kind === 'weapon') expect(ownedIds.has(c.id)).toBe(true)
      }
    }
  })

  it('never offers a new passive once the passive slots are full', () => {
    const passives = {}
    for (const p of PASSIVES.slice(0, MAX_PASSIVE_SLOTS)) passives[p.id] = 1
    const lo = loadout({ flyingSword: 1 }, passives)
    const ownedIds = new Set(Object.keys(passives))
    for (let seed = 0; seed < 100; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed))) {
        if (c.kind === 'passive') expect(ownedIds.has(c.id)).toBe(true)
      }
    }
  })

  it('offers the evolution when the weapon and its pair passive are both maxed', () => {
    const lo = loadout({ flyingSword: 5 }, { swordArt: 5 })
    const offered = rollUpgrades(lo, stats, new RNG(7))
    expect(offered.some((c) => c.kind === 'evolution' && c.id === 'myriadSwords')).toBe(true)
  })

  it('does not offer an evolution the player already owns', () => {
    const lo = loadout({ myriadSwords: 1 }, { swordArt: 5 })
    for (let seed = 0; seed < 50; seed++) {
      for (const c of rollUpgrades(lo, stats, new RNG(seed))) {
        expect(c.id).not.toBe('myriadSwords')
      }
    }
  })

  it('falls back to consumables when everything is maxed', () => {
    const weapons = {}
    for (const w of WEAPONS.slice(0, MAX_WEAPON_SLOTS)) weapons[w.id] = 5
    const passives = {}
    for (const p of PASSIVES) passives[p.id] = 5
    // Remove every evolution possibility by clearing the pair passives' weapons.
    const lo = loadout(weapons, passives)
    const offered = rollUpgrades(lo, stats, new RNG(3))
    const evolutions = offered.filter((c) => c.kind === 'evolution')
    const consumables = offered.filter((c) => c.kind === 'consumable')
    expect(evolutions.length + consumables.length).toBeGreaterThan(0)
    expect(offered).toHaveLength(3)
  })

  it('reports the level transition on an upgrade', () => {
    const offered = rollUpgrades(loadout({ flyingSword: 2 }), stats, new RNG(11))
    const sword = offered.find((c) => c.id === 'flyingSword')
    if (sword) {
      expect(sword.fromLevel).toBe(2)
      expect(sword.toLevel).toBe(3)
    }
  })

  it('is deterministic for a given seed', () => {
    const lo = loadout({ flyingSword: 1 }, { swordArt: 1 })
    const a = rollUpgrades(lo, stats, new RNG(4242)).map((c) => c.id)
    const b = rollUpgrades(lo, stats, new RNG(4242)).map((c) => c.id)
    expect(a).toEqual(b)
  })
})

describe('canEvolve', () => {
  it('is false when only the weapon is maxed', () => {
    const w = WEAPONS.find((x) => x.id === 'flyingSword')
    expect(canEvolve(loadout({ flyingSword: 5 }), w)).toBe(false)
  })

  it('is false when only the passive is maxed', () => {
    const w = WEAPONS.find((x) => x.id === 'flyingSword')
    expect(canEvolve(loadout({ flyingSword: 1 }, { swordArt: 5 }), w)).toBe(false)
  })

  it('is true when both are maxed', () => {
    const w = WEAPONS.find((x) => x.id === 'flyingSword')
    expect(canEvolve(loadout({ flyingSword: 5 }, { swordArt: 5 }), w)).toBe(true)
  })

  it('is false for a weapon with no evolution', () => {
    const w = WEAPONS.find((x) => x.id === 'baguaArray')
    expect(canEvolve(loadout({ baguaArray: 5 }, { swordArt: 5 }), w)).toBe(false)
  })
})

describe('applyChoice', () => {
  it('adds a new weapon at level 1', () => {
    const lo = loadout()
    applyChoice(lo, { kind: 'weapon', id: 'vajra', toLevel: 1 })
    expect(lo.weapons.vajra).toBe(1)
  })

  it('raises an owned weapon to the target level', () => {
    const lo = loadout({ vajra: 2 })
    applyChoice(lo, { kind: 'weapon', id: 'vajra', toLevel: 3 })
    expect(lo.weapons.vajra).toBe(3)
  })

  it('raises a passive', () => {
    const lo = loadout({}, { swordArt: 1 })
    applyChoice(lo, { kind: 'passive', id: 'swordArt', toLevel: 2 })
    expect(lo.passives.swordArt).toBe(2)
  })

  it('replaces the base weapon when evolving', () => {
    const lo = loadout({ flyingSword: 5 }, { swordArt: 5 })
    const evo = EVOLUTIONS.find((e) => e.id === 'myriadSwords')
    applyChoice(lo, { kind: 'evolution', id: evo.id, replaces: evo.evolutionOf, toLevel: 1 })
    expect(lo.weapons.flyingSword).toBeUndefined()
    expect(lo.weapons.myriadSwords).toBe(1)
  })

  it('leaves the loadout untouched for a consumable', () => {
    const lo = loadout({ vajra: 1 })
    applyChoice(lo, { kind: 'consumable', id: 'heal' })
    expect(lo.weapons).toEqual({ vajra: 1 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run test/upgrades.test.js
```

Expected: FAIL — cannot resolve `../src/combat/upgrades.js`.

- [ ] **Step 3: Write the implementation**

`src/combat/upgrades.js`:

```js
import { WEAPONS, EVOLUTIONS, getWeapon } from '../data/weapons.js'
import { PASSIVES, getPassive } from '../data/passives.js'

export const MAX_WEAPON_SLOTS = 6
export const MAX_PASSIVE_SLOTS = 6

const WEIGHT_OWNED_WEAPON = 100
const WEIGHT_OWNED_PASSIVE = 80
const WEIGHT_NEW_WEAPON = 60
const WEIGHT_NEW_PASSIVE = 50
const WEIGHT_EVOLUTION = 400

export const CONSUMABLES = [
  { id: 'heal', name: '회춘단', hanja: '回春丹', kind: 'consumable',
    desc: '기혈을 30% 회복한다.' },
  { id: 'stones', name: '영석 주머니', hanja: '靈石囊', kind: 'consumable',
    desc: '영석 200개를 얻는다.' },
  { id: 'purge', name: '정화부', hanja: '淨化符', kind: 'consumable',
    desc: '화면 안의 모든 적을 소멸시킨다.' },
]

/** A weapon can evolve when it and its paired passive are both at level 5. */
export function canEvolve(loadout, weapon) {
  if (!weapon?.evolvesTo || !weapon.pairPassive) return false
  if (loadout.weapons[weapon.id] !== 5) return false
  const passive = getPassive(weapon.pairPassive)
  return loadout.passives[weapon.pairPassive] === passive.max
}

function buildCandidates(loadout, stats) {
  const out = []
  const luck = stats.luck ?? 1
  const weaponCount = Object.keys(loadout.weapons).length
  const passiveCount = Object.keys(loadout.passives).length

  for (const w of WEAPONS) {
    const level = loadout.weapons[w.id] ?? 0
    if (canEvolve(loadout, w) && !loadout.weapons[w.evolvesTo]) {
      const evo = getWeapon(w.evolvesTo)
      out.push({
        weight: WEIGHT_EVOLUTION * luck,
        choice: {
          kind: 'evolution', id: evo.id, name: evo.name, hanja: evo.hanja,
          desc: evo.desc, replaces: w.id, fromLevel: 5, toLevel: 1,
        },
      })
      continue
    }
    if (level === 0) {
      if (weaponCount >= MAX_WEAPON_SLOTS) continue
      out.push({
        weight: WEIGHT_NEW_WEAPON * luck,
        choice: { kind: 'weapon', id: w.id, name: w.name, hanja: w.hanja, desc: w.desc, fromLevel: 0, toLevel: 1 },
      })
    } else if (level < w.levels.length) {
      out.push({
        weight: WEIGHT_OWNED_WEAPON * luck,
        choice: { kind: 'weapon', id: w.id, name: w.name, hanja: w.hanja, desc: w.desc, fromLevel: level, toLevel: level + 1 },
      })
    }
  }

  for (const p of PASSIVES) {
    const level = loadout.passives[p.id] ?? 0
    if (level >= p.max) continue
    if (level === 0 && passiveCount >= MAX_PASSIVE_SLOTS) continue
    out.push({
      weight: (level === 0 ? WEIGHT_NEW_PASSIVE : WEIGHT_OWNED_PASSIVE) * luck,
      choice: { kind: 'passive', id: p.id, name: p.name, hanja: p.hanja, desc: p.desc, fromLevel: level, toLevel: level + 1 },
    })
  }

  return out
}

/** Draw `count` distinct weighted choices without replacement. */
export function rollUpgrades(loadout, stats, rng, count = 3) {
  const pool = buildCandidates(loadout, stats)
  const picked = []

  while (picked.length < count && pool.length > 0) {
    let total = 0
    for (const c of pool) total += c.weight
    let roll = rng.next() * total
    let index = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight
      if (roll <= 0) { index = i; break }
    }
    picked.push(pool[index].choice)
    pool.splice(index, 1)
  }

  // Everything maxed out — hand out consumables instead of an empty modal.
  let fallback = 0
  while (picked.length < count) {
    picked.push({ ...CONSUMABLES[fallback % CONSUMABLES.length] })
    fallback++
  }
  return picked
}

/** Mutate the loadout to reflect a taken choice. */
export function applyChoice(loadout, choice) {
  if (choice.kind === 'weapon') {
    loadout.weapons[choice.id] = choice.toLevel
  } else if (choice.kind === 'passive') {
    loadout.passives[choice.id] = choice.toLevel
  } else if (choice.kind === 'evolution') {
    delete loadout.weapons[choice.replaces]
    loadout.weapons[choice.id] = 1
  }
  // Consumables are resolved by the caller against live run state, not the loadout.
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run test/upgrades.test.js
```

Expected: PASS, 20 tests.

- [ ] **Step 5: Run the whole suite**

```bash
npm test
```

Expected: PASS, all tests across 8 files.

- [ ] **Step 6: Commit**

```bash
git add src/combat/upgrades.js test/upgrades.test.js
git commit -m "feat(combat): add weighted level-up upgrade roll with evolutions"
```

---

**Tasks 10–24 (rendering, entities, weapons, UI, bosses) continue in
`docs/superpowers/plans/2026-07-27-xianxia-survivors-part2.md`.**

Tasks 1–9 above are the complete, fully unit-tested logic core. Everything from Task 10 onward
depends on Three.js and a browser, and is verified visually rather than with unit tests.
