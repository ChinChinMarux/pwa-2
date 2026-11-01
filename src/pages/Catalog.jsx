import { useMemo, useState } from 'react'
import {
  RefreshCw,
  Plus,
  Loader,
  AlertCircle,
  PackageOpen,
  Database,
} from 'lucide-react'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import AdvancedFilter from '../components/common/AdvancedFilter'
import Pagination from '../components/common/Pagination'
import ConfirmModal from '../components/modals/ConfirmModal'
import archiveService from '../services/archiveService'
import {
  matchesSearch,
  matchesCategory,
  sortItems,
  extractCategories,
} from '../utils/helpers'

const PAGE_SIZE_OPTIONS = [6, 12, 24, 48]

/**
 * Catalog page — the main product listing.
 *
 * Data source priority:
 *   1. Cached / live API via useGuns()
 *   2. Local static array (GUNS_LOCAL) when the API is unreachable
 *
 * Features: search, category filter, sort, pagination, CRUD + archive, share
 * links, lazy-loaded images.
 */
export default function Catalog({ onNavigate }) {
  // ---- API data (query cache + stale-while-revalidate) ----
  const {
    guns: apiGuns,
    loading,
    refreshing,
    error,
    cache,
    refetch,
  } = useGuns({ limit: 1000 })
  const [useLocal, setUseLocal] = useState(false)

  // Decide data source
  const rawGuns = useMemo(() => {
    if (useLocal || (error && apiGuns.length === 0)) {
      // Enrich local data with synthetic ids so FavoriteButton and detail work
      return GUNS_LOCAL.map((gun, index) => ({
        ...gun,
        id: gun.id || `local-${index}`,
        images: [gun.image],
      }))
    }
    return apiGuns
  }, [apiGuns, error, useLocal])

  // ---- filters / sort ----
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  const categories = useMemo(() => extractCategories(rawGuns), [rawGuns])

  const filteredGuns = useMemo(() => {
    const result = rawGuns.filter(
      (gun) => matchesSearch(gun, search) && matchesCategory(gun, activeCategory),
    )
    return sortItems(result, sortKey, sortOrder)
  }, [rawGuns, search, activeCategory, sortKey, sortOrder])

  // ---- pagination (client side, after filter + sort) ----
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])

  const totalPages = Math.max(1, Math.ceil(filteredGuns.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredGuns.slice(start, start + pageSize)
  }, [filteredGuns, safePage, pageSize])

  // Changing a filter / sort / page size restarts at page 1.
  const resetPage = () => setPage(1)

  const handleSearch = (value) => {
    setSearch(value)
    resetPage()
  }

  const handleCategory = (value) => {
    setActiveCategory(value)
    resetPage()
  }

  const handleSort = ({ key, order }) => {
    setSortKey(key)
    setSortOrder(order)
    resetPage()
  }

  const handlePageSize = (value) => {
    setPageSize(value)
    resetPage()
  }

  // ---- archive (soft delete) ----
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState('')

  const handleArchive = async () => {
    if (!archiveTarget) return
    try {
      setArchiving(true)
      setArchiveError('')
      await archiveService.archive(archiveTarget)
      setArchiveTarget(null)
      setPage(1)
      refetch()
    } catch (err) {
      setArchiveError(err?.message || 'Failed to archive product.')
    } finally {
      setArchiving(false)
    }
  }

  // ---- Main catalog view ----
  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed
          with its type, caliber, and price — nothing else.
        </p>
      </section>

      <section>
        <div className="list-head">
          <h2>Current stock</h2>
          <div className="list-head-right">
            {cache?.hit && (
              <span
                className="cache-chip"
                title={
                  cache.stale
                    ? 'Served stale from the query cache while the network was unavailable'
                    : 'Served from the in-memory query cache'
                }
              >
                <Database size={12} />
                {cache.stale ? 'cached (stale)' : 'cached'}
              </span>
            )}
            {refreshing && (
              <span className="refreshing-chip">
                <Loader size={12} className="spin" /> refreshing
              </span>
            )}
            <span className="count">
              {filteredGuns.length} piece{filteredGuns.length !== 1 ? 's' : ''}
            </span>
            {onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <AdvancedFilter
          search={search}
          onSearch={handleSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={handleCategory}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
        />

        {/* States */}
        {loading && apiGuns.length === 0 && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products…</p>
          </div>
        )}

        {!loading && error && !useLocal && apiGuns.length === 0 && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={refetch}>
                <RefreshCw size={16} /> Retry
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setUseLocal(true)}
              >
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {!loading && filteredGuns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search.</p>
          </div>
        )}

        {/* Product grid — one page at a time */}
        {pageItems.length > 0 && (
          <ul className="stock">
            {pageItems.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={(selected) =>
                  onNavigate ? onNavigate('Detail', selected) : undefined
                }
                onEdit={onNavigate ? (selected) => onNavigate('Edit', selected) : undefined}
                onArchive={(selected) => {
                  setArchiveError('')
                  setArchiveTarget(selected)
                }}
              />
            ))}
          </ul>
        )}

        {filteredGuns.length > 0 && (
          <Pagination
            page={safePage}
            pageCount={totalPages}
            pageSize={pageSize}
            total={filteredGuns.length}
            onPage={setPage}
            onPageSize={handlePageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            label="pieces"
          />
        )}

        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setUseLocal(false)
                refetch()
              }}
            >
              Retry server
            </button>
          </p>
        )}
      </section>

      {/* Archive (soft delete) confirmation */}
      <ConfirmModal
        open={Boolean(archiveTarget)}
        title="Archive Hardware Record"
        message={`Move "${archiveTarget?.name}" to the archive? It will be hidden from the catalog and can be restored later.`}
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => {
          setArchiveTarget(null)
          setArchiveError('')
        }}
      />
      {archiveError && <div className="toast toast--error">{archiveError}</div>}
    </>
  )
}
