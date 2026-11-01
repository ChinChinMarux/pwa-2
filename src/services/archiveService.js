import { apiClient, IS_SUPABASE } from '../config/api'
import gunService from './gunService'
import {
  addArchived,
  isArchived,
  listArchived,
  removeArchived,
} from '../utils/archiveStore'
import { removeGallery } from '../utils/imageStore'
import { isLocalId } from '../utils/helpers'
import { invalidateQueryCache } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// ArchiveService — soft delete (archive), restore and permanent delete.
//
// The deployed Supabase `products` table has no `archived_at` column, so the
// archive registry is local (utils/archiveStore).  When the backend grows the
// column, set VITE_ARCHIVE_REMOTE=true and the same actions are mirrored with
// a PATCH request.
// ---------------------------------------------------------------------------

const REMOTE_ARCHIVE = import.meta.env.VITE_ARCHIVE_REMOTE === 'true'

const patchRemoteArchivedAt = async (id, value) => {
  if (!REMOTE_ARCHIVE || !IS_SUPABASE || isLocalId(id)) return false
  try {
    await apiClient.patch(`/rest/v1/products?id=eq.${id}`, {
      archived_at: value,
    })
    invalidateQueryCache('guns:')
    return true
  } catch {
    // Column missing / RLS denied — local archive remains the source of truth.
    return false
  }
}

class ArchiveService {
  /**
   * Soft delete a product.  The full record is snapshotted so the archive
   * page can render it even after the product disappears from the API.
   */
  async archive(gun) {
    if (!gun || gun.id === undefined || gun.id === null) {
      throw new Error('Cannot archive a product without an id.')
    }
    const remote = await patchRemoteArchivedAt(
      gun.id,
      new Date().toISOString(),
    )
    const result = addArchived(gun)
    if (!result.success) {
      throw new Error(result.message || 'Failed to save archive record.')
    }
    gunService.invalidateCache()
    return { success: true, remote, data: result.data }
  }

  /**
   * Restore an archived product back to the catalog.
   */
  async restore(id) {
    if (id === undefined || id === null) {
      throw new Error('Cannot restore a product without an id.')
    }
    const remote = await patchRemoteArchivedAt(id, null)
    removeArchived(id)
    gunService.invalidateCache()
    return { success: true, remote }
  }

  /**
   * Permanently remove an archived product: remote delete (best effort) plus
   * local gallery + archive cleanup.  Never throws for remote failures — the
   * result reports `remote` and a `warning` string instead.
   */
  async hardDelete(id) {
    if (id === undefined || id === null) {
      throw new Error('Cannot delete a product without an id.')
    }

    let remote = true
    let warning = ''
    try {
      await gunService.deleteGun(id)
    } catch (err) {
      remote = false
      warning =
        err?.message ||
        'Server delete failed; the archived record was removed locally.'
    }

    removeArchived(id)
    removeGallery(id)
    gunService.invalidateCache()
    return { success: true, remote, warning }
  }

  list() {
    return listArchived()
  }

  isArchived(id) {
    return isArchived(id)
  }
}

export default new ArchiveService()
