import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react'
import ConfirmModal from '../components/modals/ConfirmModal'
import LazyImage from '../components/common/LazyImage'
import { listDrafts, deleteDraft, formatDraftTime } from '../utils/draftStorage'
import { formatPrice } from '../utils/helpers'

/**
 * DraftsPage — lists the localStorage drafts created by the Create/Edit forms,
 * with resume and discard actions.
 */
export default function DraftsPage({ onBack, onResume, onCreate }) {
  const [drafts, setDrafts] = useState(() => listDrafts())
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [feedback, setFeedback] = useState('')

  const refresh = () => setDrafts(listDrafts())

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteDraft(deleteTarget.id)
    setDeleteTarget(null)
    refresh()
    setFeedback('Draft discarded.')
  }

  return (
    <div className="page stack-page">
      <section className="masthead">
        <h1 className="display">Offline drafts</h1>
        <p className="lede">
          Unfinished registrations and edits stored on this device. Resume a
          draft to keep working, or discard it permanently.
        </p>
      </section>

      <div className="stack-toolbar">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>
        <div className="stack-toolbar__actions">
          <span className="count">
            {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
          </span>
          {onCreate && (
            <button type="button" className="btn btn--primary btn--sm" onClick={onCreate}>
              <Plus size={14} /> New registration
            </button>
          )}
        </div>
      </div>

      {feedback && <div className="toast toast--success">{feedback}</div>}

      {drafts.length === 0 ? (
        <div className="state-box">
          <FileText size={32} stroke="var(--steel)" />
          <h3>No drafts saved</h3>
          <p className="lede">
            Drafts are written automatically every 30 seconds while you fill the
            registration form.
          </p>
        </div>
      ) : (
        <ul className="stack-list">
          {drafts.map((draft) => (
            <li key={draft.id} className="list-item-card">
              <div className="list-item-thumb">
                {draft.image ? (
                  <LazyImage src={draft.image} alt="" />
                ) : (
                  <span className="list-item-thumb__empty">
                    <FileText size={22} />
                  </span>
                )}
              </div>

              <div className="list-item-body">
                <span className="list-item-title">{draft.name}</span>
                <span className="list-item-meta">
                  {draft.kind === 'create' ? 'New registration' : 'Edit draft'} ·{' '}
                  {draft.type}
                  {draft.price > 0 ? ` · ${formatPrice(draft.price)}` : ''}
                </span>
                <span className="list-item-meta">
                  Saved {formatDraftTime(draft.savedAt) || 'earlier'}
                  {draft.stepCount > 0 ? ` · ${draft.stepCount} steps` : ''}
                </span>
              </div>

              <div className="list-item-actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => onResume(draft)}
                >
                  Resume <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => setDeleteTarget(draft)}
                >
                  <Trash2 size={14} /> Discard
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Discard Draft"
        message={`Delete the draft "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Discard"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
