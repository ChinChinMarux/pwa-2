// ---------------------------------------------------------------------------
// reviewStore.js — local persistence for reviews and thumb reactions.
//
// The deployed reviews API can be unavailable (RLS, FK to auth.users, offline
// mode), so reviews created without a server are stored here and merged into
// every review list read.  Reactions (thumbs up / down) are also local: the
// backend has no reactions table.
// ---------------------------------------------------------------------------

import { getUserIdentifier, getUserProfile } from '../services/userService'

const REVIEWS_KEY = 'bore_barrel_local_reviews'
const REACTIONS_KEY = 'bore_barrel_review_reactions'

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

const readReviews = () => {
  const value = readJson(REVIEWS_KEY, [])
  return Array.isArray(value) ? value : []
}

const writeReviews = (reviews) => writeJson(REVIEWS_KEY, reviews)

const displayName = (profile, userId) => {
  if (profile?.username) return profile.username
  return userId ? `Operator ${String(userId).substring(0, 8)}` : 'Anonymous'
}

/**
 * Local reviews for one product, newest first.
 */
export const getLocalReviews = (gunId) => {
  if (gunId === undefined || gunId === null) return []
  const id = String(gunId)
  return readReviews()
    .filter((review) => String(review.product_id) === id)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
}

/**
 * Persist a review locally.  Used as the offline fallback of the API.
 */
export const addLocalReview = (gunId, data) => {
  const userId = data.user_id || getUserIdentifier()
  const profile = getUserProfile()
  const now = new Date().toISOString()
  const review = {
    id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    product_id: gunId,
    user_id: userId,
    user_identifier: data.user_identifier || displayName(profile, userId),
    rating: Number(data.rating) || 0,
    comment: data.comment || '',
    created_at: now,
    updated_at: now,
    local: true,
  }
  const reviews = readReviews()
  reviews.push(review)
  writeReviews(reviews)
  return review
}

export const findLocalReview = (reviewId) => {
  if (!reviewId) return null
  return readReviews().find((review) => review.id === reviewId) || null
}

export const updateLocalReview = (reviewId, data) => {
  const reviews = readReviews()
  const index = reviews.findIndex((review) => review.id === reviewId)
  if (index === -1) return null
  reviews[index] = {
    ...reviews[index],
    rating:
      data.rating === undefined
        ? reviews[index].rating
        : Number(data.rating) || 0,
    comment:
      data.comment === undefined ? reviews[index].comment : data.comment,
    updated_at: new Date().toISOString(),
  }
  writeReviews(reviews)
  return reviews[index]
}

export const deleteLocalReview = (reviewId) => {
  const reviews = readReviews()
  const filtered = reviews.filter((review) => review.id !== reviewId)
  if (filtered.length === reviews.length) return false
  writeReviews(filtered)
  removeReaction(reviewId)
  return true
}

export const clearLocalReviews = () => writeReviews([])

// ---------------------------------------------------------------------------
// Reactions (thumbs up / thumbs down)
// ---------------------------------------------------------------------------

const readReactions = () => {
  const value = readJson(REACTIONS_KEY, {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/**
 * Reaction state for one review: { up, down, mine }.
 * `mine` is 'up' | 'down' | null and represents this browser's vote.
 */
export const getReaction = (reviewId) => {
  if (!reviewId) return { up: 0, down: 0, mine: null }
  const entry = readReactions()[reviewId]
  if (!entry) return { up: 0, down: 0, mine: null }
  return {
    up: Number(entry.up) || 0,
    down: Number(entry.down) || 0,
    mine: entry.mine === 'up' || entry.mine === 'down' ? entry.mine : null,
  }
}

/**
 * Toggle this browser's reaction.  Voting the same way twice removes the
 * vote; switching sides moves it.
 */
export const toggleReaction = (reviewId, type) => {
  if (!reviewId || (type !== 'up' && type !== 'down')) {
    return getReaction(reviewId)
  }
  const reactions = readReactions()
  const entry = {
    up: Number(reactions[reviewId]?.up) || 0,
    down: Number(reactions[reviewId]?.down) || 0,
    mine: reactions[reviewId]?.mine || null,
  }

  if (entry.mine === type) {
    if (type === 'up') entry.up = Math.max(0, entry.up - 1)
    else entry.down = Math.max(0, entry.down - 1)
    entry.mine = null
  } else {
    if (entry.mine === 'up') entry.up = Math.max(0, entry.up - 1)
    if (entry.mine === 'down') entry.down = Math.max(0, entry.down - 1)
    if (type === 'up') entry.up += 1
    else entry.down += 1
    entry.mine = type
  }

  reactions[reviewId] = entry
  writeJson(REACTIONS_KEY, reactions)
  return { up: entry.up, down: entry.down, mine: entry.mine }
}

export const removeReaction = (reviewId) => {
  if (!reviewId) return false
  const reactions = readReactions()
  if (!(reviewId in reactions)) return true
  delete reactions[reviewId]
  return writeJson(REACTIONS_KEY, reactions)
}

export const clearReactions = () => writeJson(REACTIONS_KEY, {})

export default {
  getLocalReviews,
  addLocalReview,
  findLocalReview,
  updateLocalReview,
  deleteLocalReview,
  clearLocalReviews,
  getReaction,
  toggleReaction,
  removeReaction,
  clearReactions,
}
