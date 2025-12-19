function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

export function createPerKeySemaphore<TKey extends string>(maxConcurrent: number) {
  const max = Math.max(1, maxConcurrent)
  const state = new Map<TKey, { active: number, waiters: Array<ReturnType<typeof deferred<void>>> }>()

  async function acquire(key: TKey) {
    const entry = state.get(key) ?? { active: 0, waiters: [] }
    state.set(key, entry)

    if (entry.active < max) {
      entry.active++
      return
    }

    const d = deferred<void>()
    entry.waiters.push(d)
    await d.promise
    entry.active++
  }

  function release(key: TKey) {
    const entry = state.get(key)
    if (!entry) return

    entry.active = Math.max(0, entry.active - 1)
    const next = entry.waiters.shift()
    if (next) next.resolve()

    if (entry.active === 0 && entry.waiters.length === 0) {
      state.delete(key)
    }
  }

  return { acquire, release }
}
