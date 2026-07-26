/**
 * Fixed-capacity index allocator that keeps live slots in the dense range [0, count).
 *
 * Callers store entity data in their own parallel typed arrays indexed by the same
 * value. Because release() swaps the last live slot down into the freed one, callers
 * must mirror that swap using `lastSwappedFrom`:
 *
 *   pool.release(i)
 *   const moved = pool.lastSwappedFrom
 *   if (moved !== -1) copyEntity(moved, i)
 *
 * Never grows: a spawn beyond capacity is dropped and counted, so the hot loop can
 * never allocate.
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
