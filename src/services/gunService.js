import { apiClient, IS_SUPABASE } from '../config/api'
import {
  makeCacheKey,
  readQueryCache,
  writeQueryCache,
  invalidateQueryCache,
} from '../utils/queryCache'
import { resolveGunImages } from '../utils/helpers'
import {
  saveGallery,
  removeGallery,
  withSavedGallery,
} from '../utils/imageStore'
import { listArchived } from '../utils/archiveStore'

// ---------------------------------------------------------------------------
// Normalizer — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  // Resolve specifications from Supabase `specs` (text array) or API `ingredients`
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs.map((s, idx) => {
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          return {
            id: `spec-${idx}`,
            name: s.substring(0, colonIndex).trim(),
            quantity: s.substring(colonIndex + 1).trim(),
          }
        }
        return {
          id: `spec-${idx}`,
          name: 'Specification',
          quantity: s.trim(),
        }
      }
      return s
    })
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : ['Verify firearm is completely unloaded and point in safe direction.', 'Inspect receiver and mechanism for maintenance.']

  // Resolve gallery — backend `images`, `image_urls`, or a single `image_url`
  const gallery = resolveGunImages({
    images: item.images ?? item.image_urls ?? item.gallery,
    image_url: item.image_url,
    image: item.image,
  })

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: gallery[0],
    image: gallery[0],
    images: gallery,
    ingredients: specsList,
    steps: stepsList,
  }
}

const GUNS_LIST_CACHE = 'guns:list'
const GUNS_ITEM_CACHE = 'guns:item'
const LIST_TTL = 60 * 1000
const ITEM_TTL = 2 * 60 * 1000

/**
 * Drop archived products from a list.  The archived ids are read once per
 * call instead of once per product.
 */
const visibleGuns = (list) => {
  const archivedIds = new Set(
    listArchived().map((record) => String(record.id)),
  )
  return (Array.isArray(list) ? list : []).filter(
    (gun) => gun && !gun.archived_at && !archivedIds.has(String(gun.id)),
  )
}

/**
 * Merge locally saved extra gallery images onto a product.
 */
const decorate = (product) => (product ? withSavedGallery(product) : product)

// ---------------------------------------------------------------------------
// GunService — wraps backend CRUD endpoints.
// Supports both Supabase PostgREST table (/rest/v1/products) and
// standard REST API (/api/v1/recipes).
//
// GET requests are cached in utils/queryCache with a TTL and served stale on
// network failure.  Every mutation invalidates the related cache keys.
// ---------------------------------------------------------------------------
class GunService {
  /**
   * Low-level list request (no cache).
   */
  async fetchGunList(params = {}) {
    if (IS_SUPABASE) {
      const queryParts = ['select=*']

      if (params.search) {
        queryParts.push(`name=ilike.*${encodeURIComponent(params.search)}*`)
      }

      if (params.category && params.category !== 'All') {
        queryParts.push(`type=eq.${encodeURIComponent(params.category)}`)
      }

      if (params.sort_by) {
        const order = params.order === 'desc' ? 'desc' : 'asc'
        queryParts.push(`order=${encodeURIComponent(params.sort_by)}.${order}`)
      } else {
        queryParts.push('order=created_at.desc')
      }

      const limit = Number(params.limit) || 100
      queryParts.push(`limit=${limit}`)

      if (params.page && Number(params.page) > 1) {
        queryParts.push(`offset=${(Number(params.page) - 1) * limit}`)
      }

      const queryString = queryParts.join('&')
      const data = await apiClient.get(`/rest/v1/products?${queryString}`)
      const list = Array.isArray(data) ? data.map(normalizeProduct) : []

      return {
        success: true,
        data: list,
        pagination: {
          total: list.length,
          page: Number(params.page) || 1,
          limit,
        },
      }
    }

    // Fallback: university REST API
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    return apiClient.get('/api/v1/recipes', { params: clean })
  }

  /**
   * Cached product list.
   *
   * Returns `cache: { hit, stale, updatedAt }` so the UI can show whether the
   * data came from the query cache.
   */
  async getGuns(params = {}, options = {}) {
    const key = makeCacheKey(GUNS_LIST_CACHE, params)
    const cached = readQueryCache(key, LIST_TTL)

    if (cached && !cached.isStale && !options.force) {
      return {
        ...cached.data,
        data: visibleGuns(cached.data?.data).map(decorate),
        cache: { hit: true, stale: false, updatedAt: cached.updatedAt },
      }
    }

    try {
      const response = await this.fetchGunList(params)
      const cleanResponse = {
        ...response,
        data: visibleGuns(response.data).map(decorate),
      }
      writeQueryCache(key, cleanResponse)
      return {
        ...cleanResponse,
        cache: { hit: false, stale: false, updatedAt: Date.now() },
      }
    } catch (err) {
      if (cached) {
        return {
          ...cached.data,
          data: visibleGuns(cached.data?.data).map(decorate),
          cache: {
            hit: true,
            stale: true,
            fallback: true,
            updatedAt: cached.updatedAt,
          },
        }
      }
      throw err
    }
  }

  /**
   * Synchronous cache peek — lets hooks render cached data before fetching.
   */
  peekGuns(params = {}) {
    const cached = readQueryCache(makeCacheKey(GUNS_LIST_CACHE, params), LIST_TTL)
    if (!cached) return null
    return {
      ...cached.data,
      data: visibleGuns(cached.data?.data).map(decorate),
      cache: {
        hit: true,
        stale: cached.isStale,
        updatedAt: cached.updatedAt,
      },
    }
  }

  /**
   * Low-level single product request (no cache).
   */
  async fetchGunById(id) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      if (Array.isArray(data) && data.length > 0) {
        return { success: true, data: normalizeProduct(data[0]) }
      }
      throw new Error('Hardware item not found.')
    }
    return apiClient.get(`/api/v1/recipes/${id}`)
  }

  /**
   * Cached single product lookup.
   */
  async getGunById(id, options = {}) {
    if (id === undefined || id === null || id === '') {
      return { success: false, data: null, message: 'No product id provided.' }
    }

    const key = makeCacheKey(GUNS_ITEM_CACHE, { id })
    const cached = readQueryCache(key, ITEM_TTL)

    if (cached && !cached.isStale && !options.force) {
      return {
        ...cached.data,
        data: decorate(cached.data?.data),
        cache: { hit: true, stale: false, updatedAt: cached.updatedAt },
      }
    }

    try {
      const response = await this.fetchGunById(id)
      const cleanResponse = {
        ...response,
        data: response?.data ? decorate(response.data) : response?.data,
      }
      writeQueryCache(key, cleanResponse)
      return {
        ...cleanResponse,
        cache: { hit: false, stale: false, updatedAt: Date.now() },
      }
    } catch (err) {
      if (cached) {
        return {
          ...cached.data,
          data: decorate(cached.data?.data),
          cache: {
            hit: true,
            stale: true,
            fallback: true,
            updatedAt: cached.updatedAt,
          },
        }
      }
      throw err
    }
  }

  /**
   * Synchronous cache peek for a single product.
   */
  peekGun(id) {
    if (id === undefined || id === null || id === '') return null
    const cached = readQueryCache(
      makeCacheKey(GUNS_ITEM_CACHE, { id }),
      ITEM_TTL,
    )
    if (!cached) return null
    return {
      ...cached.data,
      data: decorate(cached.data?.data),
      cache: {
        hit: true,
        stale: cached.isStale,
        updatedAt: cached.updatedAt,
      },
    }
  }

  /**
   * Create a new product.
   */
  async createGun(data) {
    const gallery = resolveGunImages({
      images: data.images,
      image_url: data.image_url,
    })
    const primaryImage = gallery[0]

    let result
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : []

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: primaryImage,
      }

      const res = await apiClient.post('/rest/v1/products', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      result = { success: true, data: normalizeProduct(created) }
    } else {
      result = await apiClient.post('/api/v1/recipes', {
        ...data,
        image_url: primaryImage,
        images: gallery,
      })
    }

    // Persist the extra gallery images locally (the API only stores image_url).
    const createdId = result?.data?.id
    if (createdId !== undefined && createdId !== null) {
      saveGallery(createdId, gallery)
      if (result.data) {
        result = { ...result, data: decorate(result.data) }
      }
    }

    invalidateQueryCache('guns:')
    return result
  }

  /**
   * Update existing product.
   */
  async updateGun(id, data) {
    const hasGalleryInput =
      Array.isArray(data.images) || typeof data.image_url === 'string'
    const gallery = hasGalleryInput
      ? resolveGunImages({ images: data.images, image_url: data.image_url })
      : null

    let result
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : undefined

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      if (data.description !== undefined) payload.description = data.description
      if (specsArray !== undefined) payload.specs = specsArray
      if (gallery) payload.image_url = gallery[0]

      const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, {
        headers: { Prefer: 'return=representation' },
      })
      const updated = Array.isArray(res) ? res[0] : res
      result = { success: true, data: normalizeProduct(updated) }
    } else {
      result = await apiClient.put(`/api/v1/recipes/${id}`, {
        ...data,
        ...(gallery ? { image_url: gallery[0], images: gallery } : {}),
      })
    }

    if (gallery) {
      const savedId = result?.data?.id ?? id
      saveGallery(savedId, gallery)
    }
    if (result?.data) result = { ...result, data: decorate(result.data) }

    invalidateQueryCache('guns:')
    return result
  }

  /**
   * Partial update (PATCH).
   */
  async patchGun(id, data) {
    if (IS_SUPABASE) {
      return this.updateGun(id, data)
    }
    const response = await apiClient.patch(`/api/v1/recipes/${id}`, data)
    invalidateQueryCache('guns:')
    return response
  }

  /**
   * Hard delete product + its local gallery archive.
   */
  async deleteGun(id) {
    let response
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      response = { success: true }
    } else {
      response = await apiClient.delete(`/api/v1/recipes/${id}`)
    }
    removeGallery(id)
    invalidateQueryCache('guns:')
    return response
  }

  /**
   * Invalidate cached product queries (used after archive/restore).
   */
  invalidateCache() {
    invalidateQueryCache('guns:')
  }
}

export default new GunService()
