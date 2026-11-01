// ---------------------------------------------------------------------------
// archiveStore.js — soft delete (archive) registry.
//
// The `products` table in the deployed Supabase project has no `archived_at`
// column, so the archive lives in localStorage while still exposing the same
// API a remote implementation would need.  Set VITE_ARCHIVE_REMOTE=true when
// the backend grows the column; archiveService will then patch it remotely too.
//
// Store shape:
//   { "<id>": { id, archived_at, snapshot: { ...product } } }
// ---------------------------------------------------------------------------

const ARCHIVE_KEY = 'bore_barrel_archived_records'

/**
 * Build a serialisable snapshot of a product.  Large base64 previews are kept
 * only when storage still has room (see writeAll fallback).
 */
export const buildSnapshot = (gun) => {
  if (!gun) return null
  return {
    id: gun.id,
    name: gun.name || 'Untitled hardware',
    type: gun.type || gun.category || 'Hardware',
    category: gun.category || gun.type || 'Hardware',
    caliber: gun.caliber || 'Standard',
    price: Number(gun.price ?? gun.cook_time ?? 0),
    description: gun.description || '',
    image_url: gun.image_url || gun.image || '/guns/pistol.svg',
    images: Array.isArray(gun.images) ? gun.images.slice(0, 8) : undefined,
  }
}

const readAll = () => {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const stripHeavyImages = (map) => {
  const slim = {}
  for (const [key, record] of Object.entries(map)) {
    const snapshot = record?.snapshot
    if (!snapshot) {
      slim[key] = record
      continue
    }
    const images = (snapshot.images || []).filter(
      (url) => typeof url === 'string' && !url.startsWith('data:'),
    )
    slim[key] = {
      ...record,
      snapshot: {
        ...snapshot,
        image_url:
          typeof snapshot.image_url === 'string' && snapshot.image_url.startsWith('data:')
            ? '/guns/pistol.svg'
            : snapshot.image_url,
        images: images.length > 0 ? images.slice(0, 4) : undefined,
      },
    }
  }
  return slim
}

const writeAll = (map) => {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(map))
    return true
  } catch {
    // Storage quota exceeded — retry once without inline data URLs.
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(stripHeavyImages(map)))
      return true
    } catch {
      return false
    }
  }
}

export const isArchived = (id) => {
  if (id === undefined || id === null) return false
  return Boolean(readAll()[String(id)])
}

/**
 * Archive a product.  Idempotent: archiving twice keeps the first timestamp.
 */
export const addArchived = (gun) => {
  if (!gun || gun.id === undefined || gun.id === null) {
    return { success: false, message: 'Product has no id; cannot archive.' }
  }
  const map = readAll()
  const key = String(gun.id)
  if (!map[key]) {
    map[key] = {
      id: gun.id,
      archived_at: new Date().toISOString(),
      snapshot: buildSnapshot(gun),
    }
  }
  const saved = writeAll(map)
  return {
    success: saved,
    data: map[key],
    message: saved ? undefined : 'Could not persist archive (storage full).',
  }
}

/**
 * Restore an archived product.
 */
export const removeArchived = (id) => {
  if (id === undefined || id === null) return false
  const map = readAll()
  const key = String(id)
  if (!(key in map)) return true
  delete map[key]
  return writeAll(map)
}

/**
 * List archived records, newest first.
 */
export const listArchived = () => {
  const map = readAll()
  return Object.values(map).sort(
    (a, b) => new Date(b.archived_at).getTime() - new Date(a.archived_at).getTime(),
  )
}

export const countArchived = () => listArchived().length

export const clearArchived = () => writeAll({})

export default {
  buildSnapshot,
  isArchived,
  addArchived,
  removeArchived,
  listArchived,
  countArchived,
  clearArchived,
}
