// ---------------------------------------------------------------------------
// helpers.js — pure utility functions used across the application.
// ---------------------------------------------------------------------------

export const PLACEHOLDER_IMAGE = '/guns/pistol.svg'

/**
 * Format a numeric price as "$1,234".
 */
export const formatPrice = (price) => {
  const num = Number(price)
  if (Number.isNaN(num)) return '$0'
  return `$${num.toLocaleString()}`
}

/**
 * Client-side text search — case-insensitive match against name and
 * description.
 */
export const matchesSearch = (item, query) => {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    (item.name || '').toLowerCase().includes(q) ||
    (item.description || '').toLowerCase().includes(q)
  )
}

/**
 * Client-side category / type filter.
 * `category` of '' or 'All' matches everything.
 */
export const matchesCategory = (item, category) => {
  if (!category || category === 'All') return true
  // Support both the local `type` field and the backend `category` field
  return (
    (item.type || '').toLowerCase() === category.toLowerCase() ||
    (item.category || '').toLowerCase() === category.toLowerCase()
  )
}

/**
 * Sort an array of items by a given key.
 * @param {'name'|'price'} key
 * @param {'asc'|'desc'}   order
 */
export const sortItems = (items, key = 'name', order = 'asc') => {
  const sorted = [...items].sort((a, b) => {
    if (key === 'price') return (Number(a.price) || 0) - (Number(b.price) || 0)
    return String(a[key] || '').localeCompare(String(b[key] || ''))
  })
  return order === 'desc' ? sorted.reverse() : sorted
}

/**
 * Truncate a string to `max` characters, adding "…" when clipped.
 */
export const truncate = (str, max = 100) => {
  if (!str || str.length <= max) return str || ''
  return str.slice(0, max).trimEnd() + '…'
}

/**
 * Extract unique category values from a list of items.
 * Returns ['All', ...categories].
 */
export const extractCategories = (items) => {
  const set = new Set()
  items.forEach((i) => {
    const cat = i.type || i.category
    if (cat) set.add(cat)
  })
  return ['All', ...Array.from(set).sort()]
}

/**
 * Compute average rating from an array of review objects that each have a
 * numeric `rating` property.  Returns 0 when empty.
 */
export const averageRating = (reviews) => {
  if (!reviews || reviews.length === 0) return 0
  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0)
  return Math.round((sum / reviews.length) * 10) / 10
}

// ---------------------------------------------------------------------------
// Product galleries
// ---------------------------------------------------------------------------

const pushImageValues = (bucket, value) => {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach((entry) => pushImageValues(bucket, entry))
    return
  }
  if (typeof value !== 'string') return

  const trimmed = value.trim()
  if (!trimmed) return

  // A JSON-encoded array (common when a text column stores the gallery).
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      pushImageValues(bucket, JSON.parse(trimmed))
      return
    } catch {
      // Not JSON — treat it as a plain URL below.
    }
  }

  // Comma / pipe separated lists are accepted, except for base64 data URLs
  // whose payload contains commas.
  const isList =
    !trimmed.startsWith('data:') &&
    /[|,]/.test(trimmed) &&
    /^(https?:|\/|\.)/.test(trimmed)

  if (isList) {
    trimmed.split(/[|,]/).forEach((entry) => pushImageValues(bucket, entry))
    return
  }

  bucket.push(trimmed)
}

/**
 * Resolve a product's gallery from every supported shape:
 *   images / image_urls / gallery (array or separated string) + image_url/image.
 * Always returns at least one URL (the placeholder).
 */
export const resolveGunImages = (gun) => {
  if (!gun) return [PLACEHOLDER_IMAGE]
  const bucket = []
  pushImageValues(bucket, gun.images)
  pushImageValues(bucket, gun.image_urls)
  pushImageValues(bucket, gun.gallery)
  pushImageValues(bucket, gun.image_url)
  pushImageValues(bucket, gun.image)
  const unique = Array.from(new Set(bucket))
  return unique.length > 0 ? unique : [PLACEHOLDER_IMAGE]
}

/**
 * Build a shareable deep link to a product detail view.
 * Uses a hash route so it works on static hosting (Vercel, preview, file).
 */
export const buildGunShareUrl = (gunOrId) => {
  const id =
    gunOrId && typeof gunOrId === 'object' ? gunOrId.id ?? gunOrId.name : gunOrId
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : ''
  return `${base}#/gun/${encodeURIComponent(String(id ?? ''))}`
}

/**
 * Local fallback products are tagged `local-<n>` instead of a server UUID.
 */
export const isLocalId = (id) =>
  typeof id === 'string' && id.startsWith('local-')

/**
 * Human readable archived timestamp, e.g. "2 days ago".
 */
export const formatDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
