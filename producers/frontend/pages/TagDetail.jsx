import React, { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getTag, deleteTag, mergeTags, listTags, addTag, removeTag, listProducers } from '@producers/api'
import { ActionMenu, Alert, DataTable, EmptyState, Modal, ProducerDrawer } from '@shared/components'

const STATE_LABELS = {
  no_contact: { label: 'No contact', variant: 'neutral' },
  new: { label: 'New', variant: 'blue' },
  active: { label: 'Active', variant: 'sage' },
  waiting: { label: 'Waiting', variant: 'warm' },
  overdue: { label: 'Overdue', variant: 'rose' },
  gone_cold: { label: 'Gone cold', variant: 'neutral' },
}

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function ProducerSearch({ value, onChange, excludeIds }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      listProducers({ search: query, limit: 10 })
        .then(d => {
          const filtered = (d.producers || []).filter(p => !excludeIds.includes(p.id))
          setResults(filtered)
          setOpen(true)
        })
        .catch(() => {})
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, excludeIds])

  if (value) {
    return (
      <div className="producer-search-selected">
        <span className="cell-strong">{value.first_name} {value.last_name}</span>
        <button type="button" className="producer-search-clear" onClick={() => { onChange(null); setQuery('') }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="producer-search">
      <input
        className="input input-full"
        placeholder="Search by name..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="producer-search-dropdown">
          {results.map(p => (
            <div key={p.id} className="producer-search-option" onClick={() => { onChange(p); setOpen(false); setQuery('') }}>
              <span className="cell-strong">{p.first_name} {p.last_name}</span>
              {p.current_organization && <span className="cell-muted"> — {p.current_organization}</span>}
            </div>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="producer-search-dropdown">
          <div className="producer-search-empty">No producers found</div>
        </div>
      )}
    </div>
  )
}

export default function TagDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tag, setTag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [drawerId, setDrawerId] = useState(null)

  // Modals
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [mergeModal, setMergeModal] = useState(false)
  const [mergeTarget, setMergeTarget] = useState('')
  const [allTags, setAllTags] = useState([])
  const [addModal, setAddModal] = useState(false)
  const [addProducer, setAddProducer] = useState(null)
  const [addSaving, setAddSaving] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState(null)

  function load() {
    setLoading(true)
    setError(null)
    const offset = (page - 1) * limit
    getTag(id, { limit, offset })
      .then(data => {
        if (data.error) setError(data.error)
        else setTag(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id, page, limit])

  async function handleDelete() {
    try {
      await deleteTag(id)
      navigate('/producers/tags')
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(false)
    }
  }

  async function openMerge() {
    setMergeTarget('')
    try {
      const tags = await listTags()
      setAllTags(tags.filter(t => t.id !== parseInt(id)))
      setMergeModal(true)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleMerge() {
    if (!mergeTarget) return
    try {
      await mergeTags(parseInt(id), parseInt(mergeTarget))
      navigate('/producers/tags')
    } catch (err) {
      setError(err.message)
      setMergeModal(false)
    }
  }

  async function handleAddProducer() {
    if (!addProducer) return
    setAddSaving(true)
    try {
      await addTag(addProducer.id, tag.name)
      setAddModal(false)
      setAddProducer(null)
      load()
    } catch (err) {
      setError(err.message)
      setAddSaving(false)
    }
  }

  async function handleRemoveProducer() {
    if (!removeConfirm) return
    try {
      await removeTag(removeConfirm.id, tag.name)
      setRemoveConfirm(null)
      load()
    } catch (err) {
      setError(err.message)
      setRemoveConfirm(null)
    }
  }

  if (loading && !tag) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  if (error && !tag) {
    return <Alert variant="error" title={error} />
  }

  if (!tag) return null

  const producers = tag.producers || []

  const existingProducerIds = producers.map(p => p.id)

  const PRODUCER_COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Remove tag', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setRemoveConfirm(row) },
        ]} />
      ),
    },
    {
      key: 'last_name', label: 'Name', strong: true,
      render: (_, row) => `${row.last_name}, ${row.first_name}`,
    },
    {
      key: 'current_organization', label: 'Organization',
      render: v => v || <span className="cell-muted">&mdash;</span>,
    },
    {
      key: 'city', label: 'Location',
      render: v => v || <span className="cell-muted">&mdash;</span>,
    },
    {
      key: 'relationship_state', label: 'Relationship',
      render: v => {
        const state = STATE_LABELS[v] || STATE_LABELS.no_contact
        return (
          <span className={`status status-${state.variant}`}>
            <span className="status-dot" />
            {state.label}
          </span>
        )
      },
    },
    {
      key: 'last_contact_date', label: 'Last Contact',
      render: v => v ? relativeTime(v) : <span className="cell-muted">&mdash;</span>,
      className: 'cell-muted',
    },
  ]

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/tags" className="breadcrumb">Tags</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        <span className="breadcrumb-current">{tag.name}</span>
      </div>

      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{tag.name}</h1>
          <ActionMenu items={[
            { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/tags/${id}/edit`) },
            { label: 'Merge into...', icon: 'M5 1v6h6M1 11l4-4', onClick: openMerge },
            { divider: true },
            { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setDeleteConfirm(true) },
          ]} />
        </div>
      </div>

      <div className="detail-layout-2-5">
        <div>
          <div className="section-card">
            <div className="section-card-header">
              <h3 className="section-card-title">Details</h3>
            </div>

            <div className="sidebar-field">
              <div className="type-label">Producers</div>
              <div className="cell-strong">{tag.total}</div>
            </div>

            <div className="sidebar-field">
              <div className="type-label">Created</div>
              {tag.created_at
                ? <div className="cell-muted">{relativeTime(tag.created_at)}</div>
                : <div className="cell-muted">&mdash;</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="type-label">Description</div>
          <div className="prose">{tag.description || 'No description'}</div>
        </div>
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Producers with this tag</h3>
          <span className="section-card-meta">
            {tag.total} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => { setAddModal(true); setAddProducer(null) }}>+ Add</span>
          </span>
        </div>

        <DataTable
          data={producers}
          columns={PRODUCER_COLUMNS}
          onRowClick={row => setDrawerId(row.id)}
          pagination={{ total: tag.total, page, limit, onPageChange: setPage, onLimitChange: setLimit }}
          emptyState={
            <EmptyState
              title="No producers"
              description="No producers have this tag yet."
            />
          }
        />
      </div>

      {/* Producer drawer */}
      {drawerId && <ProducerDrawer producerId={drawerId} onClose={() => setDrawerId(null)} />}

      {/* Delete tag modal */}
      {deleteConfirm && (
        <Modal title="Delete Tag" onClose={() => setDeleteConfirm(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete Tag</button>
          </>}>
          <p className="confirm-body">
            Delete the tag <strong>&ldquo;{tag.name}&rdquo;</strong>? It will be removed from {tag.total} producer{tag.total !== 1 ? 's' : ''}. This cannot be undone.
          </p>
        </Modal>
      )}

      {/* Add producer modal */}
      {addModal && (
        <Modal title="Add Producer" onClose={() => setAddModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={addSaving || !addProducer} onClick={handleAddProducer}>
              {addSaving ? 'Adding...' : 'Add'}
            </button>
          </>}>
          <div className="form-field">
            <label className="input-label">Producer</label>
            <ProducerSearch value={addProducer} onChange={setAddProducer} excludeIds={existingProducerIds} />
          </div>
        </Modal>
      )}

      {/* Remove producer modal */}
      {removeConfirm && (
        <Modal title="Remove Tag" onClose={() => setRemoveConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setRemoveConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleRemoveProducer}>Remove</button>
          </>}>
          <p className="confirm-body">
            Remove the tag <strong>&ldquo;{tag.name}&rdquo;</strong> from <strong>{removeConfirm.first_name} {removeConfirm.last_name}</strong>? The producer record is not deleted.
          </p>
        </Modal>
      )}

      {/* Merge tag modal */}
      {mergeModal && (
        <Modal title="Merge Tag" onClose={() => setMergeModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setMergeModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleMerge} disabled={!mergeTarget}>Merge</button>
          </>}>
          <p className="confirm-body mb-16">
            Merge <strong>&ldquo;{tag.name}&rdquo;</strong> into another tag. All producers will be reassigned, and &ldquo;{tag.name}&rdquo; will be deleted.
          </p>
          <div className="form-field">
            <label className="input-label">Merge into</label>
            <div className="select-wrapper">
              <select className="select" value={mergeTarget} onChange={e => setMergeTarget(e.target.value)}>
                <option value="">Select a tag...</option>
                {allTags.map(t => (
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
