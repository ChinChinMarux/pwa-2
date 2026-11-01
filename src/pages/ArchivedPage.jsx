import { useState } from 'react'
import {
  Archive,
  ArrowLeft,
  Loader,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import ConfirmModal from '../components/modals/ConfirmModal'
import LazyImage from '../components/common/LazyImage'
import archiveService from '../services/archiveService'
import { formatPrice, formatDateTime, resolveGunImages } from '../utils/helpers'

/**
 * ArchivedPage — soft-deleted hardware records.
 * Each record can be restored to the catalog or permanently deleted.
 */
export default function ArchivedPage({ onBack }) {
  const [records, setRecords] = useState(() => archiveService.list())
  const [busyId, setBusyId] = useState(null)
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  const refresh = () => setRecords(archiveService.list())

  const handleRestore = async () => {
    if (!restoreTarget) return
    try {
      setBusyId(String(restoreTarget.id))
      setError('')
      await archiveService.restore(restoreTarget.id)
      setFeedback(`"${restoreTarget.snapshot?.name || 'Record'}" restored to catalog.`)
      setRestoreTarget(null)
      refresh()
    } catch (err) {
      setError(err?.message || 'Failed to restore record.')
    } finally {
      setBusyId(null)
    }
  }

  const handleHardDelete = async () => {
    if (!deleteTarget) return
    try {
      setBusyId(String(deleteTarget.id))
      setError('')
      const result = await archiveService.hardDelete(deleteTarget.id)
      setFeedback(
        result.warning
          ? `Removed locally. ${result.warning}`
          : `"${deleteTarget.snapshot?.name || 'Record'}" permanently deleted.`,
      )
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      setError(err?.message || 'Failed to delete record.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page stack-page">
      <section className="masthead">
        <h1 className="display">Archive</h1>
        <p className="lede">
          Soft-deleted hardware. Restore a record to bring it back to the
          catalog, or delete it permanently.
        </p>
      </section>

      <div className="stack-toolbar">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>
        <span className="count">
          {records.length} archived record{records.length !== 1 ? 's' : ''}
        </span>
      </div>

      {feedback && <div className="toast toast--success">{feedback}</div>}
      {error && <div className="toast toast--error">{error}</div>}

      {records.length === 0 ? (
        <div className="state-box">
          <Archive size={32} stroke="var(--steel)" />
          <h3>Archive is empty</h3>
          <p className="lede">
            Use the archive button on a catalog card or detail page to soft-delete
            a record without losing it.
          </p>
        </div>
      ) : (
        <ul className="stack-list">
          {records.map((record) => {
            const snapshot = record.snapshot || {}
            const images = resolveGunImages(snapshot)
            const isBusy = busyId === String(record.id)

            return (
              <li key={record.id} className="list-item-card list-item-card--archived">
                <div className="list-item-thumb">
                  <LazyImage src={images[0]} alt="" />
                </div>

                <div className="list-item-body">
                  <span className="list-item-title">
                    {snapshot.name || `Hardware ${record.id}`}
                  </span>
                  <span className="list-item-meta">
                    {snapshot.type || 'Hardware'}
                    {snapshot.caliber ? ` · ${snapshot.caliber}` : ''}
                    {snapshot.price ? ` · ${formatPrice(snapshot.price)}` : ''}
                  </span>
                  <span className="list-item-meta">
                    Archived {formatDateTime(record.archived_at)}
                  </span>
                </div>

                <div className="list-item-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => setRestoreTarget(record)}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <Loader size={14} className="spin" />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                    Restore
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => setDeleteTarget(record)}
                    disabled={isBusy}
                  >
                    <Trash2 size={14} /> Delete forever
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmModal
        open={Boolean(restoreTarget)}
        title="Restore Hardware"
        message={`Restore "${restoreTarget?.snapshot?.name || 'this record'}" to the catalog?`}
        confirmLabel="Restore"
        loading={Boolean(busyId)}
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Permanently"
        message={`Permanently delete "${deleteTarget?.snapshot?.name || 'this record'}"? This removes it from the server and cannot be undone.`}
        confirmLabel="Delete forever"
        danger
        loading={Boolean(busyId)}
        onConfirm={handleHardDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
