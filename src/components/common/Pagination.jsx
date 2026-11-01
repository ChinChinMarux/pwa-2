import { ChevronLeft, ChevronRight } from 'lucide-react'

const buildPageItems = (page, pageCount) => {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const wanted = new Set([
    1,
    2,
    page - 1,
    page,
    page + 1,
    pageCount - 1,
    pageCount,
  ])
  const pages = Array.from(wanted)
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b)

  const items = []
  let previous = 0
  for (const value of pages) {
    if (previous && value - previous > 1) {
      items.push(`gap-${value}`)
    }
    items.push(value)
    previous = value
  }
  return items
}

/**
 * Pagination — page size selector, previous/next and numbered pages.
 */
export default function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizeOptions = [6, 12, 24, 48],
  label = 'products',
}) {
  if (!total) return null

  const safePageCount = Math.max(1, pageCount)
  const currentPage = Math.min(Math.max(1, page), safePageCount)
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(total, currentPage * pageSize)
  const items = buildPageItems(currentPage, safePageCount)

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination__info">
        Showing <strong>{start}</strong>–<strong>{end}</strong> of{' '}
        <strong>{total}</strong> {label}
      </p>

      <div className="pagination__controls">
        <label className="pagination__size">
          Per page
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            aria-label="Items per page"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="pagination__pages">
          <button
            type="button"
            className="page-btn page-btn--arrow"
            onClick={() => onPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {items.map((item) =>
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                className={`page-btn${item === currentPage ? ' page-btn--active' : ''}`}
                onClick={() => onPage(item)}
                aria-current={item === currentPage ? 'page' : undefined}
                aria-label={`Page ${item}`}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="page-ellipsis" aria-hidden="true">
                …
              </span>
            ),
          )}

          <button
            type="button"
            className="page-btn page-btn--arrow"
            onClick={() => onPage(currentPage + 1)}
            disabled={currentPage >= safePageCount}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </nav>
  )
}
