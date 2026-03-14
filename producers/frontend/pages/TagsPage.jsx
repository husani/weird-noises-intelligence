import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listTags, deleteTag, mergeTags } from '@producers/api'
import { ActionMenu, Alert, DataTable, EmptyState, Modal } from '@shared/components'

export default function TagsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef(null)

  // Modals
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [mergeModal, setMergeModal] = useState(null)
  const [mergeTarget, setMergeTarget] = useState('')

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  function load() {
    setLoading(true)
    setError(null)
    listTags()
      .then(data => setItems(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = debouncedSearch
    ? items.filter(t => t.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : items

  async function handleDelete() {
    if (!deleteConfirm) return
    try {
      await deleteTag(deleteConfirm.id)
      setDeleteConfirm(null)
      load()
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(null)
    }
  }

  async function handleMerge() {
    if (!mergeModal || !mergeTarget) return
    try {
      await mergeTags(mergeModal.id, parseInt(mergeTarget))
      setMergeModal(null)
      setMergeTarget('')
      load()
    } catch (err) {
      setError(err.message)
      setMergeModal(null)
    }
  }

  const COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/tags/${row.id}/edit`) },
          ...(items.length > 1 ? [{ label: 'Merge into...', icon: 'M5 1v6h6M1 11l4-4', onClick: () => { setMergeModal(row); setMergeTarget('') } }] : []),
          { divider: true },
          { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setDeleteConfirm(row) },
        ]} />
      ),
    },
    {
      key: 'name', label: 'Tag',
      render: v => <span className="tag">{v}</span>,
    },
    {
      key: 'description', label: 'Description', className: 'cell-muted',
    },
    {
      key: 'count', label: 'Producers', number: true,
      render: v => v > 0 ? <span className="cell-strong">{v}</span> : <span className="cell-muted">0</span>,
    },
  ]

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h1 className="page-title">Tags</h1>
          <p className="page-subtitle">{items.length > 0 ? `${items.length} tag${items.length !== 1 ? 's' : ''}` : 'Organize producers with tags'}</p>
        </div>
        <div className="page-topbar-actions">
          <Link to="/producers/tags/new" className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Add Tag
          </Link>
        </div>
      </div>

      <div className="filter-row-compact">
        <div className="query-bar search-bar-constrained">
          <svg className="query-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7.5" cy="7.5" r="5.5" /><path d="M12 12l4 4" />
          </svg>
          <input className="query-input" placeholder="Search tags..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <Alert variant="error" title={error} />}

      {loading ? (
        <div className="disc-center"><div className="loading-spinner" /></div>
      ) : (
        <DataTable
          data={filtered}
          columns={COLUMNS}
          onRowClick={row => navigate(`/producers/tags/${row.id}`)}
          emptyState={
            <EmptyState
              title="No tags found"
              description={search ? 'Try a different search.' : 'Tags are created when you tag individual producers, or add one manually.'}
            />
          }
        />
      )}

      {/* Delete tag modal */}
      {deleteConfirm && (
        <Modal title="Delete Tag" onClose={() => setDeleteConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete Tag</button>
          </>}>
          <p className="confirm-body">
            Delete the tag <strong>&ldquo;{deleteConfirm.name}&rdquo;</strong>? It will be removed from {deleteConfirm.count} producer{deleteConfirm.count !== 1 ? 's' : ''}. This cannot be undone.
          </p>
        </Modal>
      )}

      {/* Merge tag modal */}
      {mergeModal && (
        <Modal title="Merge Tag" onClose={() => setMergeModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setMergeModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleMerge} disabled={!mergeTarget}>Merge</button>
          </>}>
          <p className="confirm-body mb-16">
            Merge <strong>&ldquo;{mergeModal.name}&rdquo;</strong> into another tag. All producers with this tag will be reassigned, and &ldquo;{mergeModal.name}&rdquo; will be deleted.
          </p>
          <div className="form-field">
            <label className="input-label">Merge into</label>
            <div className="select-wrapper">
              <select className="select" value={mergeTarget} onChange={e => setMergeTarget(e.target.value)}>
                <option value="">Select a tag...</option>
                {items.filter(t => t.id !== mergeModal.id).map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.count})</option>
                ))}
              </select>
              <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
