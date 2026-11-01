import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Archive,
  ChevronLeft,
  ChevronRight,
  Loader,
  Pencil,
  RotateCcw,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import ShareButton from '../common/ShareButton'
import LazyImage from '../common/LazyImage'
import { useReviews, useReviewMutations } from '../../hooks/useReviews'
import { getUserIdentifier } from '../../services/userService'
import {
  formatPrice,
  averageRating,
  resolveGunImages,
  formatDateTime,
} from '../../utils/helpers'

function StarPicker({ value, onChange, disabled = false }) {
  return (
    <div className="review-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="star-btn"
          onClick={() => onChange(star)}
          disabled={disabled}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <Star
            size={22}
            fill={star <= value ? 'var(--brass)' : 'none'}
            stroke={star <= value ? 'var(--brass)' : 'var(--steel)'}
          />
        </button>
      ))}
    </div>
  )
}

/**
 * Full-screen product detail view.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data (multi-image aware)
 * @param {Function} props.onBack    — return to catalog
 * @param {Function} [props.onEdit]  — navigate to edit page
 * @param {Function} [props.onArchive] — soft delete the product
 * @param {Function} [props.onRestore] — restore an archived product
 * @param {boolean}  [props.archived]  — product is currently archived
 */
export default function GunDetail({
  gun,
  onBack,
  onEdit,
  onArchive,
  onRestore,
  archived = false,
}) {
  const images = useMemo(() => resolveGunImages(gun), [gun])
  const [activeImage, setActiveImage] = useState(0)
  const safeImage = Math.min(activeImage, images.length - 1)

  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0
  const currentUserId = getUserIdentifier()

  // Reviews
  const {
    reviews,
    loading: reviewsLoading,
    offline,
    refetch: refetchReviews,
  } = useReviews(gun.id)
  const mutations = useReviewMutations(gun.id)

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [formError, setFormError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editRating, setEditRating] = useState(5)
  const [editComment, setEditComment] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [reactionState, setReactionState] = useState({})

  const avgRating = gun.average_rating || averageRating(reviews)
  const reviewCount = reviewsLoading ? gun.review_count || 0 : reviews.length

  const isOwner = (review) =>
    Boolean(review.user_id) && String(review.user_id) === String(currentUserId)

  const reactionFor = (reviewId) =>
    reactionState[reviewId] || mutations.getReaction(reviewId)

  const handleSubmitReview = async (event) => {
    event.preventDefault()
    setFormError('')
    setFormMessage('')

    const result = await mutations.create({
      user_identifier: undefined,
      rating,
      comment: comment.trim(),
    })

    if (result?.success) {
      setFormMessage(
        result.offline
          ? 'Review saved offline — it will stay on this device.'
          : 'Review submitted!',
      )
      setComment('')
      setRating(5)
      await refetchReviews()
    } else {
      setFormError(mutations.error || 'Could not submit review.')
    }
  }

  const startEdit = (review) => {
    setEditingId(review.id)
    setEditRating(review.rating)
    setEditComment(review.comment || '')
    setConfirmDeleteId(null)
    setActionMessage('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditRating(5)
    setEditComment('')
  }

  const saveEdit = async (reviewId) => {
    const result = await mutations.update(reviewId, {
      rating: editRating,
      comment: editComment.trim(),
    })
    if (result?.success) {
      setActionMessage(result.offline ? 'Review updated (offline).' : 'Review updated.')
      cancelEdit()
      await refetchReviews()
    }
  }

  const deleteReview = async (reviewId) => {
    const result = await mutations.remove(reviewId)
    if (result?.success) {
      setActionMessage(
        result.offline ? 'Review deleted (offline).' : 'Review deleted.',
      )
      setConfirmDeleteId(null)
      if (editingId === reviewId) cancelEdit()
      await refetchReviews()
    }
  }

  const react = (reviewId, type) => {
    const result = mutations.react(reviewId, type)
    setReactionState((previous) => ({ ...previous, [reviewId]: result }))
  }

  return (
    <div className="detail">
      {/* Back button */}
      <button type="button" className="detail-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      {archived && (
        <div className="notice notice--warning">
          <Archive size={16} /> This hardware record is archived and hidden from
          the catalog.
          {onRestore && (
            <button type="button" className="link-btn" onClick={onRestore}>
              Restore now
            </button>
          )}
        </div>
      )}

      {/* Hero + gallery */}
      <div className="detail-hero">
        <div className="detail-gallery">
          <div className="detail-gallery-main">
            <LazyImage
              src={images[safeImage]}
              alt={`${gun.name} — image ${safeImage + 1} of ${images.length}`}
              eager
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="gallery-nav gallery-nav--prev"
                  onClick={() =>
                    setActiveImage(
                      (previous) => (previous - 1 + images.length) % images.length,
                    )
                  }
                  aria-label="Previous image"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="gallery-nav gallery-nav--next"
                  onClick={() =>
                    setActiveImage((previous) => (previous + 1) % images.length)
                  }
                  aria-label="Next image"
                >
                  <ChevronRight size={18} />
                </button>
                <span className="gallery-count">
                  {safeImage + 1}/{images.length}
                </span>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="detail-thumbs">
              {images.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  className={`detail-thumb${index === safeImage ? ' detail-thumb--active' : ''}`}
                  onClick={() => setActiveImage(index)}
                  aria-label={`Show image ${index + 1}`}
                  aria-current={index === safeImage}
                >
                  <LazyImage src={url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <h1 className="display">{gun.name}</h1>
          <p className="type">
            {category}
            {caliber ? ` · ${caliber}` : ''}
          </p>
          <p className="price detail-price">{formatPrice(price)}</p>

          {avgRating > 0 && (
            <p className="detail-rating">
              <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
              {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
            </p>
          )}

          <div className="detail-actions">
            <FavoriteButton gunId={gun.id || gun.name} />
            <ShareButton gun={gun} showLabel className="btn btn--outline" />
            {onEdit && !archived && (
              <button type="button" className="btn btn--outline" onClick={() => onEdit(gun)}>
                <Pencil size={15} /> Edit
              </button>
            )}
            {!archived && onArchive && (
              <button type="button" className="btn btn--danger" onClick={() => onArchive(gun)}>
                <Archive size={15} /> Archive
              </button>
            )}
            {archived && onRestore && (
              <button type="button" className="btn btn--primary" onClick={onRestore}>
                <RotateCcw size={15} /> Restore
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <section className="detail-section">
        <h2>Description</h2>
        <p>{gun.description || 'No description available.'}</p>
      </section>

      {/* Specifications (from ingredients / steps if present) */}
      {gun.ingredients && gun.ingredients.length > 0 && (
        <section className="detail-section">
          <h2>Specifications</h2>
          <ul className="detail-specs">
            {gun.ingredients.map((ing, index) => (
              <li key={ing.id || index}>
                <strong>{ing.name}</strong> — {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {gun.steps && gun.steps.length > 0 && (
        <section className="detail-section">
          <h2>Assembly / Maintenance Steps</h2>
          <ol className="detail-steps">
            {gun.steps.map((step, index) => (
              <li key={step.id || index}>{step.instruction || step}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Reviews Section */}
      <section className="detail-section">
        <h2>Reviews</h2>

        {offline && (
          <p className="form-hint review-offline">
            Review server unavailable — showing reviews saved on this device.
          </p>
        )}

        {/* Submit review */}
        <form className="review-form" onSubmit={handleSubmitReview}>
          <StarPicker value={rating} onChange={setRating} disabled={mutations.busy} />

          <textarea
            className="review-input"
            rows="3"
            placeholder="Write a short review (optional)…"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
          />

          <button
            type="submit"
            className="btn btn--primary"
            disabled={mutations.busy || !gun.id}
          >
            {mutations.busy ? (
              <>
                <Loader size={16} className="spin" /> Submitting…
              </>
            ) : (
              <>
                <Send size={16} /> Submit Review
              </>
            )}
          </button>

          {formError && <p className="form-error">{formError}</p>}
          {formMessage && <p className="form-success">{formMessage}</p>}
          {!gun.id && (
            <p className="form-hint">
              Reviews require a server-generated product ID. This product is local-only.
            </p>
          )}
        </form>

        {actionMessage && <p className="form-success review-action-msg">{actionMessage}</p>}
        {mutations.error && <p className="form-error">{mutations.error}</p>}

        {/* Existing reviews */}
        {reviewsLoading && reviews.length === 0 ? (
          <p className="detail-loading">Loading reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list">
            {reviews.map((review) => {
              const owner = isOwner(review)
              const reaction = reactionFor(review.id)
              const upCount = (Number(review.upvotes) || 0) + reaction.up
              const downCount = (Number(review.downvotes) || 0) + reaction.down

              return (
                <li key={review.id} className="review-item">
                  {editingId === review.id ? (
                    <div className="review-edit">
                      <div className="review-head">
                        <span className="review-user">Edit your review</span>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={cancelEdit}
                          aria-label="Cancel editing"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <StarPicker
                        value={editRating}
                        onChange={setEditRating}
                        disabled={mutations.busy}
                      />
                      <textarea
                        className="review-input"
                        rows="3"
                        value={editComment}
                        onChange={(event) => setEditComment(event.target.value)}
                        maxLength={500}
                      />
                      <div className="review-edit-actions">
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={cancelEdit}
                          disabled={mutations.busy}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => saveEdit(review.id)}
                          disabled={mutations.busy}
                        >
                          {mutations.busy ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="review-head">
                        <span className="review-user">
                          {review.user_identifier || 'Anonymous'}
                          {owner && <span className="review-owner-badge">you</span>}
                          {review.local && (
                            <span className="review-owner-badge review-owner-badge--offline">
                              offline
                            </span>
                          )}
                        </span>
                        <span className="review-stars-display">
                          {Array.from({ length: 5 }, (_, index) => (
                            <Star
                              key={index}
                              size={14}
                              fill={index < review.rating ? 'var(--brass)' : 'none'}
                              stroke={index < review.rating ? 'var(--brass)' : 'var(--line)'}
                            />
                          ))}
                        </span>
                      </div>

                      {review.comment && (
                        <p className="review-comment">{review.comment}</p>
                      )}

                      <div className="review-foot">
                        <div className="review-reactions">
                          <button
                            type="button"
                            className={`reaction-btn${reaction.mine === 'up' ? ' reaction-btn--active' : ''}`}
                            onClick={() => react(review.id, 'up')}
                            aria-pressed={reaction.mine === 'up'}
                            aria-label="Thumbs up"
                            title="Thumbs up"
                          >
                            <ThumbsUp size={14} /> {upCount}
                          </button>
                          <button
                            type="button"
                            className={`reaction-btn${reaction.mine === 'down' ? ' reaction-btn--active' : ''}`}
                            onClick={() => react(review.id, 'down')}
                            aria-pressed={reaction.mine === 'down'}
                            aria-label="Thumbs down"
                            title="Thumbs down"
                          >
                            <ThumbsDown size={14} /> {downCount}
                          </button>
                          <span className="review-date">
                            {formatDateTime(review.created_at)}
                            {review.updated_at &&
                              review.updated_at !== review.created_at &&
                              ' · edited'}
                          </span>
                        </div>

                        {owner && (
                          <div className="review-owner-actions">
                            {confirmDeleteId === review.id ? (
                              <>
                                <span className="review-confirm">Delete?</span>
                                <button
                                  type="button"
                                  className="btn btn--danger btn--sm"
                                  onClick={() => deleteReview(review.id)}
                                  disabled={mutations.busy}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--outline btn--sm"
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={mutations.busy}
                                >
                                  Keep
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => startEdit(review)}
                                  aria-label="Edit review"
                                  title="Edit review"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => setConfirmDeleteId(review.id)}
                                  aria-label="Delete review"
                                  title="Delete review"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="detail-empty">No reviews yet. Be the first!</p>
        )}
      </section>
    </div>
  )
}
