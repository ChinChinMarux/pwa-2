import { apiClient, IS_SUPABASE } from '../config/api'
import { getUserIdentifier, getUserProfile } from './userService'
import {
  makeCacheKey,
  readQueryCache,
  writeQueryCache,
  invalidateQueryCache,
} from '../utils/queryCache'
import {
  addLocalReview,
  deleteLocalReview,
  getLocalReviews,
  getReaction,
  removeReaction,
  toggleReaction,
  updateLocalReview,
} from '../utils/reviewStore'
import { isLocalId } from '../utils/helpers'

// ---------------------------------------------------------------------------
// ReviewService — product reviews & ratings.
// Supports Supabase (public.reviews) and university API
// (/api/v1/recipes/:id/reviews).
//
// Offline-first: when the API rejects a mutation the review is persisted in
// localStorage (utils/reviewStore) and merged into every subsequent list read.
// Reactions (thumbs up/down) are local — the backend has no reactions table.
// ---------------------------------------------------------------------------

const REVIEWS_KEY = 'reviews:list'
const REVIEWS_TTL = 30 * 1000

const currentUserName = () => {
  const profile = getUserProfile()
  return profile?.username || ''
}

const displayName = (userId) => {
  const ownId = getUserIdentifier()
  if (userId && String(userId) === String(ownId)) {
    return currentUserName() || 'You'
  }
  return userId ? `Operator ${String(userId).substring(0, 8)}` : 'Anonymous'
}

const normalizeReview = (row) => {
  if (!row) return null
  return {
    id: row.id,
    product_id: row.product_id,
    user_id: row.user_id,
    user_identifier:
      row.user_identifier || displayName(row.user_id),
    rating: Number(row.rating) || 0,
    comment: row.comment || '',
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    upvotes: Number(row.upvotes) || 0,
    downvotes: Number(row.downvotes) || 0,
    local: Boolean(row.local),
  }
}

/**
 * Merge remote reviews with locally saved ones, de-duplicated by id and
 * sorted newest first.
 */
const mergeReviews = (gunId, remoteReviews = []) => {
  const byId = new Map()
  for (const review of remoteReviews) {
    const normalized = normalizeReview(review)
    if (normalized) byId.set(String(normalized.id), normalized)
  }
  for (const review of getLocalReviews(gunId)) {
    const normalized = normalizeReview(review)
    if (normalized && !byId.has(String(normalized.id))) {
      byId.set(String(normalized.id), normalized)
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime(),
  )
}

const invalidateReviews = () => {
  invalidateQueryCache('reviews:')
}

class ReviewService {
  /**
   * Low-level remote fetch (no cache).
   */
  async fetchRemoteReviews(gunId) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(
        `/rest/v1/reviews?product_id=eq.${gunId}&select=*&order=created_at.desc`,
      )
      const list = Array.isArray(data) ? data.map(normalizeReview) : []
      return { success: true, data: list }
    }

    return apiClient.get(`/api/v1/recipes/${gunId}/reviews`)
  }

  /**
   * Fetch all reviews for a product, cached for 30 seconds.
   * Never rejects for network errors: offline results carry `offline: true`.
   */
  async getReviews(gunId, options = {}) {
    if (gunId === undefined || gunId === null) {
      return { success: true, data: [], offline: false }
    }

    // Local-only products have no server row — never call the API.
    if (isLocalId(gunId)) {
      return {
        success: true,
        data: mergeReviews(gunId, []),
        offline: true,
      }
    }

    const key = makeCacheKey(REVIEWS_KEY, { gunId })
    const cached = readQueryCache(key, REVIEWS_TTL)

    if (cached && !cached.isStale && !options.force) {
      return {
        ...cached.data,
        data: mergeReviews(gunId, cached.data.data),
        cache: { hit: true, stale: false },
      }
    }

    try {
      const response = await this.fetchRemoteReviews(gunId)
      const remoteList = Array.isArray(response?.data) ? response.data : []
      const merged = mergeReviews(gunId, remoteList)
      const result = { success: true, data: merged, offline: false }
      writeQueryCache(key, { ...result, data: remoteList })
      return { ...result, cache: { hit: false, stale: false } }
    } catch (err) {
      const merged = mergeReviews(
        gunId,
        cached?.data?.data && Array.isArray(cached.data.data)
          ? cached.data.data
          : [],
      )
      return {
        success: true,
        data: merged,
        offline: true,
        message: err?.message || 'Reviews are offline.',
        cache: { hit: false, stale: true },
      }
    }
  }

  /**
   * Submit a new review.  Falls back to local persistence when the API is
   * unavailable so the review is never lost.
   */
  async createReview(gunId, reviewData) {
    const rating = Number(reviewData.rating)
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5.')
    }

    const userId = reviewData.user_id || getUserIdentifier()
    const localPayload = {
      user_id: userId,
      user_identifier: reviewData.user_identifier || currentUserName(),
      rating,
      comment: reviewData.comment || '',
    }

    if (!isLocalId(gunId)) {
      try {
        let created
        if (IS_SUPABASE) {
          const res = await apiClient.post(
            '/rest/v1/reviews',
            {
              product_id: Number(gunId),
              user_id: userId,
              rating,
              comment: localPayload.comment,
            },
            { headers: { Prefer: 'return=representation' } },
          )
          created = Array.isArray(res) ? res[0] : res
        } else {
          created = await apiClient.post(
            `/api/v1/recipes/${gunId}/reviews`,
            localPayload,
          )
        }

        invalidateReviews()
        return {
          success: true,
          data: normalizeReview(created),
          offline: false,
        }
      } catch (err) {
        // Fall through to the local store.
        invalidateReviews()
        const local = addLocalReview(gunId, localPayload)
        return {
          success: true,
          data: normalizeReview(local),
          offline: true,
          message: err?.message,
        }
      }
    }

    invalidateReviews()
    const local = addLocalReview(gunId, localPayload)
    return { success: true, data: normalizeReview(local), offline: true }
  }

  /**
   * Edit a review.  Locally created reviews are edited in place; remote
   * reviews require a reachable API.
   */
  async updateReview(reviewId, reviewData) {
    const rating = Number(reviewData.rating)
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5.')
    }

    if (typeof reviewId === 'string' && reviewId.startsWith('local-')) {
      const updated = updateLocalReview(reviewId, {
        rating,
        comment: reviewData.comment || '',
      })
      if (!updated) throw new Error('Review not found.')
      invalidateReviews()
      return { success: true, data: normalizeReview(updated), offline: true }
    }

    let res
    if (IS_SUPABASE) {
      res = await apiClient.patch(
        `/rest/v1/reviews?id=eq.${reviewId}`,
        { rating, comment: reviewData.comment || '' },
        { headers: { Prefer: 'return=representation' } },
      )
      res = Array.isArray(res) ? res[0] : res
    } else {
      res = await apiClient.put(`/api/v1/reviews/${reviewId}`, {
        rating,
        comment: reviewData.comment || '',
      })
    }

    invalidateReviews()
    return { success: true, data: normalizeReview(res), offline: false }
  }

  /**
   * Delete a review.
   */
  async deleteReview(reviewId) {
    if (typeof reviewId === 'string' && reviewId.startsWith('local-')) {
      deleteLocalReview(reviewId)
      invalidateReviews()
      return { success: true, offline: true }
    }

    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/reviews?id=eq.${reviewId}`)
    } else {
      await apiClient.delete(`/api/v1/reviews/${reviewId}`)
    }
    removeReaction(reviewId)
    invalidateReviews()
    return { success: true, offline: false }
  }

  /**
   * Toggle a thumb reaction ('up' | 'down') for this browser.
   */
  reactToReview(reviewId, type) {
    return { success: true, data: toggleReaction(reviewId, type) }
  }

  /**
   * Current reaction state for a review: { up, down, mine }.
   */
  getReviewReaction(reviewId) {
    return getReaction(reviewId)
  }
}

export default new ReviewService()
