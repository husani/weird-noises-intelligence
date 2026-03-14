import React, { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getVenue, deleteVenue, listAllProductions, addVenueProduction, removeVenueProduction } from '@producers/api'
import { ActionMenu, Alert, DataTable, EmptyState, Modal, ProducerDrawer } from '@shared/components'

/* ── Production search typeahead ── */

function ProductionSearch({ value, onChange, excludeIds }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      listAllProductions({ search: query, limit: 8 })
        .then(d => {
          const filtered = (d.productions || []).filter(p => !excludeIds.includes(p.id))
          setResults(filtered)
          setOpen(filtered.length > 0)
        })
        .catch(() => {})
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, excludeIds])

  if (value) {
    return (
      <div className="producer-search-selected">
        <span className="cell-strong">{value.title}{value.year ? ` (${value.year})` : ''}</span>
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
        placeholder="Search by title..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="producer-search-dropdown">
          {results.map(p => (
            <div key={p.id} className="producer-search-option" onClick={() => { onChange(p); setOpen(false); setQuery('') }}>
              <span className="cell-strong">{p.title}</span>
              {p.year && <span className="cell-muted"> ({p.year})</span>}
              {p.scale && <span className="cell-muted"> — {p.scale.display_label}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main page ── */

export default function VenueDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [venue, setVenue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [addSelection, setAddSelection] = useState(null)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [prodPage, setProdPage] = useState(1)
  const [prodLimit, setProdLimit] = useState(25)
  const [drawerId, setDrawerId] = useState(null)

  function load() {
    setLoading(true)
    setError(null)
    getVenue(id)
      .then(data => {
        if (data.error) setError(data.error)
        else setVenue(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  async function handleDelete() {
    try {
      const result = await deleteVenue(id)
      if (result.error) {
        setError(result.error)
        setDeleteConfirm(false)
      } else {
        navigate('/producers/venues')
      }
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!addSelection) return
    setAddSaving(true)
    setAddError(null)
    try {
      const result = await addVenueProduction(parseInt(id), addSelection.id)
      if (result.error) { setAddError(result.error); setAddSaving(false) }
      else { setAddModal(false); setAddSelection(null); setAddSaving(false); load() }
    } catch (err) {
      setAddError(err.message)
      setAddSaving(false)
    }
  }

  async function handleRemove() {
    if (!removeConfirm) return
    try {
      const result = await removeVenueProduction(parseInt(id), removeConfirm.id)
      if (result.error) setError(result.error)
      setRemoveConfirm(null)
      load()
    } catch (err) {
      setError(err.message)
      setRemoveConfirm(null)
    }
  }

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  if (error && !venue) {
    return <Alert variant="error" title={error} />
  }

  if (!venue) return null

  const productions = venue.productions || []
  const venueProducers = venue.producers || []
  const existingProductionIds = productions.map(p => p.id)

  const PRODUCTION_COLUMNS = [
    {
      key: '_remove', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <button className="btn-icon" title="Remove from venue" onClick={e => { e.stopPropagation(); setRemoveConfirm(row) }}>
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4" />
          </svg>
        </button>
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
    { key: 'producer_count', label: 'Producers', number: true },
  ]

  const PRODUCER_COLUMNS = [
    {
      key: 'last_name', label: 'Name', strong: true,
      render: (_, row) => `${row.last_name}, ${row.first_name}`,
    },
    { key: 'production_count', label: 'Productions', number: true },
  ]

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/venues" className="breadcrumb">Venues</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        <span className="breadcrumb-current">{venue.name}</span>
      </div>

      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{venue.name}</h1>
          <ActionMenu items={[
            { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/venues/${id}/edit`) },
            { divider: true },
            { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setDeleteConfirm(true) },
          ]} />
        </div>
      </div>

      {error && <Alert variant="error" title={error} />}

      <div className="detail-layout-2-5">
        <div>
          <div className="section-card">
            <div className="section-card-header">
              <h3 className="section-card-title">Details</h3>
            </div>

            <div className="sidebar-field">
              <div className="type-label">Type</div>
              {venue.venue_type
                ? <span className={`badge ${venue.venue_type.css_class}`}>{venue.venue_type.display_label}</span>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Location</div>
              {[venue.city, venue.state_region, venue.country].filter(Boolean).length > 0
                ? <div>{[venue.city, venue.state_region, venue.country].filter(Boolean).join(', ')}</div>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Capacity</div>
              {venue.capacity
                ? <div>{venue.capacity.toLocaleString()}</div>
                : <div className="cell-muted">&mdash;</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="type-label">Description</div>
          <div className="prose">{venue.description || <span className="cell-muted">&mdash;</span>}</div>
        </div>
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Productions at {venue.name}</h3>
          <span className="section-card-meta">
            {productions.length} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => setAddModal(true)}>+ Add</span>
          </span>
        </div>

        <DataTable
          data={productions}
          columns={PRODUCTION_COLUMNS}
          pagination={{ total: productions.length, page, limit, onPageChange: setPage, onLimitChange: setLimit }}
          emptyState={
            <EmptyState
              title="No productions"
              description="No productions are currently linked to this venue."
            />
          }
        />
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Producers who have had productions at {venue.name}</h3>
          <span className="section-card-meta">{venueProducers.length} total</span>
        </div>

        <DataTable
          data={venueProducers}
          columns={PRODUCER_COLUMNS}
          onRowClick={row => setDrawerId(row.id)}
          pagination={{ total: venueProducers.length, page: prodPage, limit: prodLimit, onPageChange: setProdPage, onLimitChange: setProdLimit }}
          emptyState={
            <EmptyState
              title="No producers"
              description="No producers have had productions at this venue yet."
            />
          }
        />
      </div>

      {/* Delete venue modal */}
      {deleteConfirm && (
        <Modal title="Delete Venue" onClose={() => setDeleteConfirm(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{venue.name}</strong>
            {productions.length > 0 && <span> and unlink it from {productions.length} production{productions.length !== 1 ? 's' : ''}</span>}
            ? This cannot be undone.
          </p>
        </Modal>
      )}

      {/* Add production modal */}
      {addModal && (
        <Modal title="Add Production" onClose={() => { setAddModal(false); setAddSelection(null); setAddError(null) }}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { setAddModal(false); setAddSelection(null); setAddError(null) }}>Cancel</button>
            <button className="btn btn-primary" disabled={addSaving || !addSelection} onClick={handleAdd}>
              {addSaving ? 'Adding...' : 'Add'}
            </button>
          </>}>
          {addError && <Alert variant="error" title={addError} />}
          <form onSubmit={handleAdd}>
            <div className="form-field">
              <label className="input-label">Production</label>
              <ProductionSearch value={addSelection} onChange={setAddSelection} excludeIds={existingProductionIds} />
            </div>
          </form>
        </Modal>
      )}

      {/* Producer drawer */}
      {drawerId && <ProducerDrawer producerId={drawerId} onClose={() => setDrawerId(null)} />}

      {/* Remove production confirmation */}
      {removeConfirm && (
        <Modal title="Remove production?" onClose={() => setRemoveConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setRemoveConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleRemove}>Remove</button>
          </>}>
          <p className="confirm-body">
            Remove <strong>{removeConfirm.title}</strong> from {venue.name}? This only removes the venue link — the production record is not deleted.
          </p>
        </Modal>
      )}
    </>
  )
}
