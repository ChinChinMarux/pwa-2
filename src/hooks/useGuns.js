import { useCallback, useEffect, useRef, useState } from 'react'
import gunService from '../services/gunService'

// ---------------------------------------------------------------------------
// useGuns — fetch the product list through the cached GunService.
//
// Behaviour:
//   1. Renders cached data immediately when available (query cache peek).
//   2. Revalidates in the background (stale-while-revalidate).
//   3. Falls back to stale cached data when the network fails.
//
// Returns { guns, loading, refreshing, error, pagination, cache, refetch }.
// ---------------------------------------------------------------------------

const parseParams = (paramKey) => {
  try {
    return JSON.parse(paramKey)
  } catch {
    return {}
  }
}

export function useGuns(params = {}) {
  const paramKey = JSON.stringify(params)

  const [guns, setGuns] = useState(() => {
    const peek = gunService.peekGuns(params)
    return peek?.data || []
  })
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(
    () => !gunService.peekGuns(params),
  )
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [cache, setCache] = useState(null)
  const requestIdRef = useRef(0)

  const fetchGuns = useCallback(
    async ({ force = false, silent = false } = {}) => {
      const requestId = ++requestIdRef.current
      if (!silent) setRefreshing(true)

      try {
        const response = await gunService.getGuns(parseParams(paramKey), {
          force,
        })
        if (requestId !== requestIdRef.current) return

        if (response?.success) {
          setGuns(response.data || [])
          setPagination(response.pagination || null)
          setCache(response.cache || null)
          setError(null)
        } else {
          setError(response?.message || 'Failed to fetch products.')
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setError(err?.message || 'An error occurred while fetching products.')
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [paramKey],
  )

  useEffect(() => {
    const peek = gunService.peekGuns(parseParams(paramKey))
    if (peek) {
      setGuns(peek.data || [])
      setPagination(peek.pagination || null)
      setCache(peek.cache || null)
      setLoading(false)
    } else {
      setLoading(true)
    }
    fetchGuns()
  }, [paramKey, fetchGuns])

  return {
    guns,
    loading,
    refreshing,
    error,
    pagination,
    cache,
    refetch: () => fetchGuns({ force: true }),
    revalidate: () => fetchGuns({ silent: true }),
  }
}

// ---------------------------------------------------------------------------
// useGunById — fetch a single product by UUID, cache-first.
// ---------------------------------------------------------------------------

export function useGunById(id) {
  const [gun, setGun] = useState(() => gunService.peekGun(id)?.data || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cache, setCache] = useState(null)
  const requestIdRef = useRef(0)

  const fetchGun = useCallback(
    async ({ force = false, silent = false } = {}) => {
      if (!id) {
        setGun(null)
        setLoading(false)
        return
      }

      const requestId = ++requestIdRef.current
      if (!silent) setLoading(true)

      try {
        const response = await gunService.getGunById(id, { force })
        if (requestId !== requestIdRef.current) return

        if (response?.success) {
          setGun(response.data)
          setCache(response.cache || null)
          setError(null)
        } else {
          setError(response?.message || 'Product not found.')
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setError(err?.message || 'Failed to load product details.')
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    const peek = gunService.peekGun(id)
    if (peek) {
      setGun(peek.data)
      setCache(peek.cache || null)
    }
    fetchGun()
  }, [id, fetchGun])

  return {
    gun,
    loading,
    error,
    cache,
    refetch: () => fetchGun({ force: true }),
  }
}
