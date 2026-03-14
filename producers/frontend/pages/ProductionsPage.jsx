import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listAllProductions, deleteProduction } from '@producers/api'
import { ActionMenu, Alert, DataTable, EmptyState, Modal } from '@shared/components'

export default function ProductionsPage() {
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
    listAllProductions({ search: debouncedSearch, limit, offset })
      .then(d => { setItems(d.productions || []); setTotal(d.total || 0) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [debouncedSearch, page, limit])

  async function handleDelete() {
    if (!deleteConfirm) return
    try {
      const result = await deleteProduction(deleteConfirm.id)
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
          { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/productions/${row.id}/edit`) },
          { divider: true },
          { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setDeleteConfirm(row) },
        ]} />
      ),
    },
    { key: 'title', label: 'Title', strong: true },
    { key: 'year', label: 'Year' },
    {
      key: 'scale', label: 'Scale',
      render: v => v
        ? <span className={`badge ${v.css_class}`}>{v.display_label}</span>
        : null,
    },
    {
      key: 'venue', label: 'Venue', sortable: false,
      render: (v) => v ? (
        <div>
          <div className="cell-strong">{v.name}</div>
          {[v.city, v.state_region, v.country].filter(Boolean).length > 0 && (
            <div className="cell-muted">{[v.city, v.state_region, v.country].filter(Boolean).join(', ')}</div>
          )}
        </div>
      ) : <span className="cell-muted">&mdash;</span>,
    },
    {
      key: 'producers', label: 'Producers', number: true, sortable: false,
      render: (v) => v && v.length > 0 ? v.length : <span className="cell-muted">&mdash;</span>,
    },
  ]

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h1 className="page-title">Productions</h1>
          <p className="page-subtitle">{total > 0 ? `${total} production${total !== 1 ? 's' : ''}` : 'Shows and productions tracked in the database'}</p>
        </div>
        <div className="page-topbar-actions">
          <Link to="/producers/productions/new" className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Add Production
          </Link>
        </div>
      </div>

      <div className="filter-row-compact">
        <div className="query-bar search-bar-constrained">
          <svg className="query-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7.5" cy="7.5" r="5.5" /><path d="M12 12l4 4" />
          </svg>
          <input className="query-input" placeholder="Search productions..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <Alert variant="error" title={error} />}

      {loading ? (
        <div className="disc-center"><div className="loading-spinner" /></div>
      ) : (
        <DataTable
          data={items}
          columns={COLUMNS}
          onRowClick={row => navigate(`/producers/productions/${row.id}`)}
          pagination={{ total, page, limit, onPageChange: setPage, onLimitChange: setLimit }}
          emptyState={
            <EmptyState
              title="No productions found"
              description={search ? 'Try a different search.' : 'Productions are created when producers are researched, or add them manually.'}
            />
          }
        />
      )}

      {deleteConfirm && (
        <Modal title="Delete Production" onClose={() => setDeleteConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{deleteConfirm.title}</strong>
            {deleteConfirm.producers?.length > 0 && <span> and unlink it from {deleteConfirm.producers.length} producer{deleteConfirm.producers.length !== 1 ? 's' : ''}</span>}
            ? This cannot be undone.
          </p>
        </Modal>
      )}
    </>
  )
}
