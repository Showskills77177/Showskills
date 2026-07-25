/**
 * Run async work over items with a fixed concurrency limit.
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} mapper
 * @returns {Promise<R[]>}
 */
export async function mapWithConcurrency(items, concurrency, mapper) {
  if (!items.length) return []
  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array(items.length)
  let cursor = 0

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (cursor < items.length) {
        const index = cursor
        cursor += 1
        results[index] = await mapper(items[index], index)
      }
    }),
  )

  return results
}

/**
 * Throttle expensive progress writes (e.g. DB updates during parallel work).
 * @param {(payload: unknown) => Promise<void>} write
 * @param {number} [minIntervalMs]
 */
export function createThrottledWriter(write, minIntervalMs = 800) {
  let lastWrite = 0
  let inflight = null

  return async function throttledWrite(payload, { force = false } = {}) {
    const now = Date.now()
    if (!force && now - lastWrite < minIntervalMs) return
    lastWrite = now
    inflight = write(payload)
    await inflight
    inflight = null
  }
}

/**
 * Fire-and-forget progress heartbeat so the Production UI doesn't freeze on a single %
 * while SerpAPI / ffmpeg work with no scene-index advances.
 * @param {() => Promise<void> | void} tick
 * @param {number} [intervalMs]
 * @returns {() => void} stop
 */
export function startProgressHeartbeat(tick, intervalMs = 4000) {
  const ms = Math.max(1500, Number(intervalMs) || 4000)
  const id = setInterval(() => {
    try {
      void Promise.resolve(tick()).catch(() => {})
    } catch {
      /* ignore */
    }
  }, ms)
  return () => clearInterval(id)
}
