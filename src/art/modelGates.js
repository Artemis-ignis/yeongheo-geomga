/**
 * Headless quality gates for generated models.
 *
 * Every creature in this game is generated as code — there is no .glb to diff,
 * so a model that quietly degenerates into a lump ships unnoticed. These gates
 * measure a merged BufferGeometry the way a player actually reads it at 60
 * enemies on screen: silhouette first, colour second, triangle budget third.
 *
 * The approach is lifted from img2threejs — build procedurally, then gate on
 * measurements rather than trusting that it looks fine. Everything here is pure
 * math over the vertex buffers, so it runs in plain node with no GPU and can sit
 * in the test suite instead of in a screenshot review.
 */
import * as THREE from 'three'

/** Silhouette raster resolution. 72 is enough to resolve ears and tails. */
const RES = 72

/** Yaw angles the silhouette is measured from, in radians. */
const YAWS = [0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4]

function positionsOf(geometry) {
  const pos = geometry.getAttribute('position')
  const index = geometry.getIndex()
  if (index === null) return { pos, order: null, tris: pos.count / 3 }
  return { pos, order: index, tris: index.count / 3 }
}

/**
 * Orthographic projection of the geometry onto the XY plane after a yaw spin,
 * expressed in world units. Framing is applied later so every yaw can share one
 * scale — otherwise a narrow front view gets stretched to look like the wide
 * side view and the "does it read differently when it turns" metric dies.
 */
function project(geometry, yaw) {
  const { pos } = positionsOf(geometry)
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const out = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    out[i * 2] = x * cos - z * sin
    out[i * 2 + 1] = y
  }
  return out
}

/** Fill one triangle into the mask with a barycentric inside test. */
function fillTriangle(mask, ax, ay, bx, by, cx, cy) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)))
  const maxX = Math.min(RES - 1, Math.ceil(Math.max(ax, bx, cx)))
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)))
  const maxY = Math.min(RES - 1, Math.ceil(Math.max(ay, by, cy)))
  if (minX > maxX || minY > maxY) return

  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  if (area === 0) return
  const inv = 1 / area

  for (let py = minY; py <= maxY; py++) {
    const sy = py + 0.5
    for (let px = minX; px <= maxX; px++) {
      const sx = px + 0.5
      const w0 = ((bx - sx) * (cy - sy) - (by - sy) * (cx - sx)) * inv
      if (w0 < 0) continue
      const w1 = ((cx - sx) * (ay - sy) - (cy - sy) * (ax - sx)) * inv
      if (w1 < 0) continue
      const w2 = 1 - w0 - w1
      if (w2 < 0) continue
      mask[py * RES + px] = 1
    }
  }
}

/**
 * Rasterise the silhouette at one yaw. `scale` and the centring offsets are
 * passed in so every yaw of a model shares one framing.
 */
function rasterise(geometry, yaw, scale, cx, cy) {
  const flat = project(geometry, yaw)
  const { order, tris } = positionsOf(geometry)
  const mask = new Uint8Array(RES * RES)
  const half = RES / 2

  const px = (i) => (flat[i * 2] - cx) * scale + half
  const py = (i) => (flat[i * 2 + 1] - cy) * scale + half

  for (let t = 0; t < tris; t++) {
    const a = order === null ? t * 3 : order.getX(t * 3)
    const b = order === null ? t * 3 + 1 : order.getX(t * 3 + 1)
    const c = order === null ? t * 3 + 2 : order.getX(t * 3 + 2)
    fillTriangle(mask, px(a), py(a), px(b), py(b), px(c), py(c))
  }
  return mask
}

function maskArea(mask) {
  let n = 0
  for (let i = 0; i < mask.length; i++) n += mask[i]
  return n
}

/** Cells on the boundary — filled, with at least one empty or off-grid neighbour. */
function maskPerimeter(mask) {
  let n = 0
  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) {
      if (mask[y * RES + x] === 0) continue
      if (
        x === 0 || x === RES - 1 || y === 0 || y === RES - 1 ||
        mask[y * RES + x - 1] === 0 || mask[y * RES + x + 1] === 0 ||
        mask[(y - 1) * RES + x] === 0 || mask[(y + 1) * RES + x] === 0
      ) n++
    }
  }
  return n
}

/** Tight bounding rectangle of the filled cells, as [w, h]. */
function maskExtent(mask) {
  let minX = RES, maxX = -1, minY = RES, maxY = -1
  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) {
      if (mask[y * RES + x] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return [0, 0]
  return [maxX - minX + 1, maxY - minY + 1]
}

function maskIoU(a, b) {
  let inter = 0
  let union = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] | b[i]) union++
    if (a[i] & b[i]) inter++
  }
  return union === 0 ? 1 : inter / union
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function saturationOf(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max <= 0 ? 0 : (max - min) / max
}

/** Distinct vertex colours, quantised so shading gradients do not inflate the count. */
function colourStats(geometry) {
  const col = geometry.getAttribute('color')
  if (!col) return { colours: 0, contrast: 0, saturation: 0, meanLuma: 0 }

  const buckets = new Map()
  let lumaSum = 0
  let satSum = 0
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i)
    const g = col.getY(i)
    const b = col.getZ(i)
    lumaSum += luminance(r, g, b)
    satSum += saturationOf(r, g, b)
    const key = `${Math.round(r * 12)},${Math.round(g * 12)},${Math.round(b * 12)}`
    if (!buckets.has(key)) buckets.set(key, { r, g, b, n: 0 })
    buckets.get(key).n++
  }

  // Ignore buckets that cover less than 1% of the mesh — a stray seam vertex is
  // not a colour the player can see.
  const floor = col.count * 0.01
  const significant = [...buckets.values()].filter((c) => c.n >= floor)
  const lumas = significant.map((c) => luminance(c.r, c.g, c.b))

  return {
    colours: significant.length,
    contrast: lumas.length ? Math.max(...lumas) - Math.min(...lumas) : 0,
    saturation: satSum / col.count,
    meanLuma: lumaSum / col.count,
  }
}

/**
 * Measure a merged model geometry.
 *
 * - `coverage`  how much of its own bounding rectangle the silhouette fills.
 *               A cube is 1.0 from every angle; limbs and gaps drive it down.
 * - `complexity` isoperimetric quotient of the outline: 1.0 is a perfect circle,
 *               higher means an articulated edge (ears, tails, spikes).
 * - `turn`      1 − IoU between the front and side silhouettes. A sphere is 0 —
 *               it looks identical however it spins. A wolf is high.
 */
export function measureModel(geometry) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const size = new THREE.Vector3()
  box.getSize(size)

  // One shared framing for every yaw: the widest horizontal reach, so nothing
  // clips and a narrow view genuinely reads as narrow.
  const reach = Math.max(
    Math.hypot(box.max.x, box.max.z),
    Math.hypot(box.min.x, box.min.z),
    Math.hypot(box.max.x, box.min.z),
    Math.hypot(box.min.x, box.max.z),
  )
  const span = Math.max(reach * 2, size.y, 1e-4)
  const scale = (RES * 0.92) / span
  const cx = 0
  const cy = (box.max.y + box.min.y) / 2

  const masks = YAWS.map((yaw) => rasterise(geometry, yaw, scale, cx, cy))

  let coverage = 0
  let complexity = 0
  for (const mask of masks) {
    const area = maskArea(mask)
    const [w, h] = maskExtent(mask)
    coverage += w * h === 0 ? 0 : area / (w * h)
    const perim = maskPerimeter(mask)
    complexity += area === 0 ? 0 : (perim * perim) / (4 * Math.PI * area)
  }
  coverage /= masks.length
  complexity /= masks.length

  const { pos, tris } = positionsOf(geometry)

  return {
    vertices: pos.count,
    triangles: tris,
    size: [size.x, size.y, size.z],
    height: size.y,
    coverage,
    complexity,
    turn: 1 - maskIoU(masks[0], masks[2]),
    ...colourStats(geometry),
  }
}

/**
 * Thresholds every shipped creature must clear.
 *
 * These are floors, not targets — they are set just under the weakest model that
 * genuinely reads well in game, so they catch a regression without freezing the
 * art direction in place.
 */
export const CREATURE_GATES = {
  triangles: [120, 6000],
  height: [0.6, 6.0],
  coverage: [0.18, 0.78],
  complexity: [1.25, 12.0],
  turn: [0.12, 1.0],
  colours: [3, 40],
  contrast: [0.12, 1.0],
  saturation: [0.10, 0.95],
}

/**
 * Check a measurement against a limit table.
 * Returns a list of human-readable failures; empty means the model passes.
 */
export function checkModel(metrics, gates = CREATURE_GATES) {
  const failures = []
  for (const [key, [min, max]] of Object.entries(gates)) {
    const value = metrics[key]
    if (typeof value !== 'number' || Number.isNaN(value)) {
      failures.push(`${key} is not a number (${value})`)
    } else if (value < min) {
      failures.push(`${key} ${value.toFixed(3)} is below the floor ${min}`)
    } else if (value > max) {
      failures.push(`${key} ${value.toFixed(3)} is above the ceiling ${max}`)
    }
  }
  return failures
}

/** Silhouette mask at one yaw, exposed so dev tooling can draw what the gate saw. */
export function silhouetteMask(geometry, yaw = 0) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const size = new THREE.Vector3()
  box.getSize(size)
  const reach = Math.max(Math.hypot(box.max.x, box.max.z), Math.hypot(box.min.x, box.min.z))
  const span = Math.max(reach * 2, size.y, 1e-4)
  return {
    res: RES,
    mask: rasterise(geometry, yaw, (RES * 0.92) / span, 0, (box.max.y + box.min.y) / 2),
  }
}
