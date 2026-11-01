// ---------------------------------------------------------------------------
// queryCache.js — small in-memory query cache with TTL + stale read support.
//
// Every service GET can write its result here.  Reads report whether the
// entry is still fresh, so hooks can serve cached data immediately and
// revalidate in the background (stale-while-revalidate).
//
// The cache lives for the lifetime of the browser tab.  Writes invalidate
// related keys so a mutation never leaves a stale list behind.
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 60 * 1000
const MAX_ENTRIES = 80

/** key -> { data, updatedAt } (Map preserves insertion order for eviction) */
const store = new Map()

/**
 * Deterministic JSON serialisation (sorted object keys) so two logically
 * equal parameter objects always map to the same cache key.
 */
const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const keys = Object.keys(value).sort()
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`
}

/**
 * Build a namespaced cache key, e.g. makeCacheKey('guns:list', { limit: 100 }).
 */
export const makeCacheKey = (namespace, params = {}) =>
  `${namespace}:${stableStringify(params)}`

const evictOverflow = () => {
  while (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value
    store.delete(oldestKey)
  }
}

/**
 * Read a cache entry.
 * @returns {{ data: any, updatedAt: number, age: number, isStale: boolean } | null}
 */
export const readQueryCache = (key, ttl = DEFAULT_TTL_MS) => {
  const entry = store.get(key)
  if (!entry) return null
  const age = Date.now() - entry.updatedAt
  return {
    data: entry.data,
    updatedAt: entry.updatedAt,
    age,
    isStale: age > ttl,
  }
}

/**
 * Store a value under `key`.
 */
export const writeQueryCache = (key, data) => {
  store.delete(key)
  store.set(key, { data, updatedAt: Date.now() })
  evictOverflow()
  return data
}

/**
 * Drop entries whose key starts with `prefix` (string) or matches a RegExp.
 */
export const invalidateQueryCache = (prefix) => {
  const matcher =
    prefix instanceof RegExp
      ? (key) => prefix.test(key)
      : (key) => String(key).startsWith(String(prefix))

  let removed = 0
  for (const key of Array.from(store.keys())) {
    if (matcher(key)) {
      store.delete(key)
      removed += 1
    }
  }
  return removed
}

export const clearQueryCache = () => store.clear()

export const getQueryCacheStats = () => ({
  size: store.size,
  keys: Array.from(store.keys()),
})
