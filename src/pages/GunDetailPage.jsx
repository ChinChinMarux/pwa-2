import { useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, Loader } from 'lucide-react'
import GunDetail from '../components/gun/GunDetail'
import ConfirmModal from '../components/modals/ConfirmModal'
import { useGunById } from '../hooks/useGuns'
import archiveService from '../services/archiveService'
import { isArchived } from '../utils/archiveStore'

/**
 * GunDetailPage — route container for `#/gun/:id`.
 *
 * Renders instantly from a remembered card object when available, and
 * otherwise loads the product by id (deep link / page reload).
 */
export default function GunDetailPage({ gun: initialGun, gunId, onBack, onEdit }) {
  const { gun: fetchedGun, loading, error, refetch } = useGunById(gunId)
  const gun = fetchedGun || initialGun

  const [archived, setArchived] = useState(() => isArchived(gunId))
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const canEdit = useMemo(
    () => Boolean(gun) && !archived && Boolean(onEdit),
    [gun, archived, onEdit],
  )

  const handleArchive = async () => {
    if (!gun) return
    try {
      setBusy(true)
      setActionError('')
      await archiveService.archive(gun)
      setArchived(true)
      setArchiveOpen(false)
      if (onBack) onBack()
    } catch (err) {
      setActionError(err?.message || 'Failed to archive record.')
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async () => {
    try {
      setBusy(true)
      setActionError('')
      await archiveService.restore(gun?.id ?? gunId)
      setArchived(false)
      refetch()
    } catch (err) {
      setActionError(err?.message || 'Failed to restore record.')
    } finally {
      setBusy(false)
    }
  }

  if (!gun && loading) {
    return (
      <div className="state-box">
        <Loader size={28} className="spin" />
        <p>Loading hardware record…</p>
      </div>
    )
  }

  if (!gun && error) {
    return (
      <div className="state-box state-box--error">
        <AlertCircle size={28} />
        <p>{error}</p>
        <div className="state-box__actions">
          <button type="button" className="btn btn--outline" onClick={onBack}>
            <ArrowLeft size={16} /> Back
          </button>
          <button type="button" className="btn btn--outline" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!gun) {
    return (
      <div className="state-box">
        <AlertCircle size={28} />
        <p>Hardware record not found.</p>
        <button type="button" className="btn btn--outline" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Catalog
        </button>
      </div>
    )
  }

  return (
    <>
      <GunDetail
        gun={gun}
        archived={archived}
        onBack={onBack}
        onEdit={canEdit ? onEdit : undefined}
        onArchive={() => setArchiveOpen(true)}
        onRestore={handleRestore}
      />

      {actionError && <div className="toast toast--error">{actionError}</div>}

      <ConfirmModal
        open={archiveOpen}
        title="Archive Hardware Record"
        message={`Move "${gun.name}" to the archive? It will be hidden from the catalog and can be restored later.`}
        confirmLabel="Archive"
        loading={busy}
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
      />
    </>
  )
}
