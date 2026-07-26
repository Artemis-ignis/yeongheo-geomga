/**
 * Uniform-grid broadphase over the XZ plane.
 *
 * Rebuilt from scratch every tick — at our entity counts that is cheaper than
 * incremental updates and has no stale-key failure mode.
 *
 * `query` is a broadphase: it may return ids slightly outside `radius` (anything
 * sharing an overlapping cell) but never omits an id whose point is within it.
 * Callers do the exact distance check.
 */
export class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize
    this.inv = 1 / cellSize
    this.cells = new Map()
    this.freeLists = []
  }

  clear() {
    // Recycle the arrays rather than dropping them, so steady state allocates nothing.
    for (const list of this.cells.values()) {
      list.length = 0
      this.freeLists.push(list)
    }
    this.cells.clear()
  }

  _key(cx, cz) {
    // Our arena is ~70 units across, so cell coordinates stay far inside ±32768.
    return (cx + 32768) * 65536 + (cz + 32768)
  }

  insert(id, x, z) {
    const key = this._key(Math.floor(x * this.inv), Math.floor(z * this.inv))
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
