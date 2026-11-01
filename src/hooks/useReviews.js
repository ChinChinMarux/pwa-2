import { useCallback, useEffect, useRef, useState } from 'react'
import reviewService from '../services/reviewService'

// ---------------------------------------------------------------------------
// useReviews — fetch reviews for a specific product (cached + offline safe).
// ---------------------------------------------------------------------------

export function useReviews(gunId) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState(null)
  const requestIdRef = useRef(0)

  const fetchReviews = useCallback(
    async ({ force = false, silent = false } = {}) => {
      if (!gunId) {
        setReviews([])
        setLoading(false)
        return
      }

      const requestId = ++requestIdRef.current
      if (!silent) setRefreshing(true)

      try {
        const response = await reviewService.getReviews(gunId, { force })
        if (requestId !== requestIdRef.current) return

        if (response?.success) {
          setReviews(response.data || [])
          setOffline(Boolean(response.offline))
          setError(null)
        } else {
          setError(response?.message || 'Failed to fetch reviews.')
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setError(err?.message || 'An error occurred while fetching reviews.')
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [gunId],
  )

  useEffect(() => {
    setLoading(true)
    fetchReviews()
  }, [gunId, fetchReviews])

  return {
    reviews,
    loading,
    refreshing,
    offline,
    error,
    refetch: () => fetchReviews({ force: true }),
  }
}

// ---------------------------------------------------------------------------
// useReviewMutations — create / update / delete / react in one hook.
// ---------------------------------------------------------------------------

export function useReviewMutations(gunId) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = async (operation) => {
    setBusy(true)
    setError(null)
    try {
      return await operation()
    } catch (err) {
      setError(err?.message || 'Review action failed.')
      return null
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    error,
    clearError: () => setError(null),
    create: (payload) => run(() => reviewService.createReview(gunId, payload)),
    update: (reviewId, payload) =>
      run(() => reviewService.updateReview(reviewId, payload)),
    remove: (reviewId) => run(() => reviewService.deleteReview(reviewId)),
    react: (reviewId, type) => reviewService.reactToReview(reviewId, type).data,
    getReaction: (reviewId) =>
      reviewService.getReviewReaction(reviewId),
  }
}

// ---------------------------------------------------------------------------
// useCreateReview — legacy helper retained for compatibility.
// ---------------------------------------------------------------------------

export function useCreateReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const createReview = async (gunId, reviewData) => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const response = await reviewService.createReview(gunId, reviewData)
      setSuccess(Boolean(response?.success))
      return response?.data || null
    } catch (err) {
      setError(err?.message || 'An error occurred while submitting review.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createReview, loading, error, success }
}
