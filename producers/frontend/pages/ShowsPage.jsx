import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listShows, deleteShow } from '@producers/api'
import { ActionMenu, Alert, DataTable, EmptyState, Modal } from '@shared/components'

export default function ShowsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  function load() {
    setLoading(true)
    setError(null)
    const offset = (page - 1) * limit
    listShows({ search: debouncedSearch, limit, offset })
      .then(d => { setItems(d.shows || []); setTotal(d.total || 0) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [debouncedSearch, page, limit])

  async function handleDelete() {
    if (!deleteConfirm) return
    try {
      const result = await deleteShow(deleteConfirm.id)
      if (result.error) {
        setError(result.error)
        setDeleteConfirm(null)
      } else {
        setDeleteConfirm(null)
        load()
      }
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(null)
    }
  }

  const COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/shows/${row.id}/edit`) },
          { divider: true },
          { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setDeleteConfirm(row) },
        ]} />
      ),
    },
    { key: 'title', label: 'Title', strong: true },
    {
      key: 'medium', label: 'Medium',
      render: v => v
        ? <span className={`badge ${v.css_class}`}>{v.display_label}</span>
        : null,
    },
    { key: 'original_year', label: 'Original Year' },
    { key: 'description', label: 'Description', className: 'cell-muted' },
    {
      key: 'production_count', label: 'Productions', number: true,
      render: v => v > 0 ? <span className="cell-strong">{v}</span> : null,
    },
  ]

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h1 className="page-title">Shows</h1>
          <p className="page-subtitle">{total > 0 ? `${total} show${total !== 1 ? 's' : ''}` : 'Theatrical works as intellectual property'}</p>
        </div>
        <div className="page-topbar-actions">
          <Link to="/producers/shows/new" className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Add Show
          </Link>
        </div>
      </div>

      <div className="filter-row-compact">
        <div className="query-bar search-bar-constrained">
          <svg className="query-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7.5" cy="7.5" r="5.5" /><path d="M12 12l4 4" />
          </svg>
          <input className="query-input" placeholder="Search shows..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <Alert variant="error" title={error} />}

      {loading ? (
        <div className="disc-center"><div className="loading-spinner" /></div>
      ) : (
        <DataTable
          data={items}
          columns={COLUMNS}
          onRowClick={row => navigate(`/producers/shows/${row.id}`)}
          pagination={{ total, page, limit, onPageChange: setPage, onLimitChange: setLimit }}
          emptyState={
            <EmptyState
              title="No shows found"
              description={search ? 'Try a different search.' : 'Add shows to track theatrical works and their productions.'}
            />
          }
        />
      )}

      {deleteConfirm && (
        <Modal title="Delete Show" onClose={() => setDeleteConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{deleteConfirm.title}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </>
  )
}
