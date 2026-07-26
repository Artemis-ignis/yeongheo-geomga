/** Minimal synchronous event emitter, used to keep the simulation from importing UI. */
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
