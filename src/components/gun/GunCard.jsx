import { useMemo, useState } from 'react'
import { Archive, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import ShareButton from '../common/ShareButton'
import LazyImage from '../common/LazyImage'
import { formatPrice, resolveGunImages, truncate } from '../../utils/helpers'

/**
 * Product card used in the catalog grid.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data (supports multiple images)
 * @param {Function} props.onSelect  — called with the gun when clicked
 * @param {Function} [props.onEdit]  — called when Edit is clicked (admin)
 * @param {Function} [props.onArchive] — soft delete the product
 */
export default function GunCard({ gun, onSelect, onEdit, onArchive }) {
  const images = useMemo(() => resolveGunImages(gun), [gun])
  const [imageIndex, setImageIndex] = useState(0)

  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0
  const safeIndex = Math.min(imageIndex, images.length - 1)
  const hasGallery = images.length > 1

  const handleSelect = () => onSelect && onSelect(gun)

  const step = (event, direction) => {
    event.stopPropagation()
    setImageIndex((previous) => {
      const next = previous + direction
      return (next + images.length) % images.length
    })
  }

  return (
    <li className="card">
      <div className="card-gallery">
        <button
          type="button"
          className="card-media"
          onClick={handleSelect}
          aria-label={`View ${gun.name}`}
        >
          <LazyImage
            src={images[safeIndex]}
            alt={`${gun.name} — image ${safeIndex + 1} of ${images.length}`}
            width="240"
            height="180"
          />
        </button>

        {hasGallery && (
          <>
            <button
              type="button"
              className="gallery-nav gallery-nav--prev"
              onClick={(event) => step(event, -1)}
              aria-label="Previous image"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              className="gallery-nav gallery-nav--next"
              onClick={(event) => step(event, 1)}
              aria-label="Next image"
            >
              <ChevronRight size={15} />
            </button>
            <span className="gallery-count">
              {safeIndex + 1}/{images.length}
            </span>
            <span className="gallery-dots" aria-hidden="true">
              {images.map((url, index) => (
                <span
                  key={`${url}-${index}`}
                  className={`gallery-dot${index === safeIndex ? ' gallery-dot--active' : ''}`}
                />
              ))}
            </span>
          </>
        )}
      </div>

      <button
        type="button"
        className="card-body"
        onClick={handleSelect}
        aria-label={`View ${gun.name} details`}
      >
        <span className="name display">{gun.name}</span>

        <span className="type">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>

        {gun.description && (
          <span className="card-desc">{truncate(gun.description, 72)}</span>
        )}

        <span className="price">{formatPrice(price)}</span>
      </button>

      <div className="card-actions">
        <FavoriteButton gunId={gun.id || gun.name} />

        <ShareButton gun={gun} />

        {onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(event) => {
              event.stopPropagation()
              onEdit(gun)
            }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            <Pencil size={14} />
          </button>
        )}

        {onArchive && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(event) => {
              event.stopPropagation()
              onArchive(gun)
            }}
            aria-label={`Archive ${gun.name}`}
            title="Archive (soft delete)"
          >
            <Archive size={14} />
          </button>
        )}
      </div>
    </li>
  )
}
