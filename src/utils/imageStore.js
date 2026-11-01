// ---------------------------------------------------------------------------
// imageStore.js — local persistence for multi-image product galleries.
//
// The current backend schema only exposes a single `image_url` column, so the
// extra gallery images are persisted in localStorage keyed by product id and
// merged back onto every product the services read.  When a backend later
// exposes an `images` column, normalizeProduct already understands it.
//
// Store shape: { "<product id>": ["url", ...] }
// ---------------------------------------------------------------------------

import { resolveGunImages } from './helpers'

const GALLERY_KEY = 'bore_barrel_gun_images'
export const MAX_GALLERY_IMAGES = 8

const readAll = () => {
  try {
    const raw = localStorage.getItem(GALLERY_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const writeAll = (map) => {
  try {
    localStorage.setItem(GALLERY_KEY, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}

/**
 * Normalise a list of image urls: trim, drop empties, de-duplicate and cap
 * the gallery to MAX_GALLERY_IMAGES.
 */
export const normalizeGallery = (images) => {
  const list = Array.isArray(images) ? images : [images]
  const cleaned = []
  for (const value of list) {
    if (typeof value !== 'string') continue
    const url = value.trim()
    if (!url) continue
    if (!cleaned.includes(url)) cleaned.push(url)
  }
  return cleaned.slice(0, MAX_GALLERY_IMAGES)
}

/**
 * Return the locally stored gallery for a product, or [].
 */
export const getSavedGallery = (id) => {
  if (id === undefined || id === null) return []
  const map = readAll()
  const saved = map[String(id)]
  return Array.isArray(saved) ? normalizeGallery(saved) : []
}

/**
 * Persist a product gallery.  An empty gallery removes the entry.
 */
export const saveGallery = (id, images) => {
  if (id === undefined || id === null) return false
  const gallery = normalizeGallery(images)
  if (gallery.length === 0) return removeGallery(id)

  const map = readAll()
  map[String(id)] = gallery
  return writeAll(map)
}

/**
 * Remove a product's gallery (used on hard delete).
 */
export const removeGallery = (id) => {
  if (id === undefined || id === null) return false
  const map = readAll()
  if (!(String(id) in map)) return true
  delete map[String(id)]
  return writeAll(map)
}

/**
 * Drop gallery entries for products that no longer exist.
 */
export const pruneGalleries = (validIds = []) => {
  const valid = new Set(validIds.map((id) => String(id)))
  const map = readAll()
  let changed = false
  for (const key of Object.keys(map)) {
    if (!valid.has(key)) {
      delete map[key]
      changed = true
    }
  }
  if (changed) writeAll(map)
  return changed
}

/**
 * Merge a product with its locally stored gallery and return a new object
 * whose `image_url` always points at the primary (first) image.
 */
export const withSavedGallery = (product) => {
  if (!product) return product
  const saved = getSavedGallery(product.id)
  const gallery = saved.length > 0 ? saved : resolveGunImages(product)
  return { ...product, images: gallery, image_url: gallery[0], image: gallery[0] }
}

export default {
  MAX_GALLERY_IMAGES,
  normalizeGallery,
  getSavedGallery,
  saveGallery,
  removeGallery,
  pruneGalleries,
  withSavedGallery,
}
