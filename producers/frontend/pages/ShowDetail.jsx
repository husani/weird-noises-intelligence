import React, { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getShow, deleteShow, listProducers, addProducerToShow, removeProducerFromShow, addShowProduction, removeShowProduction, listAllProductions } from '@producers/api'
import { ActionMenu, Alert, DataTable, EmptyState, Modal, ProducerDrawer } from '@shared/components'
import ProductionDrawer from '@producers/components/ProductionDrawer'
import { useLookupValues } from '@shared/hooks/useLookupValues'

/* ── Producer search typeahead ── */

function ProducerSearch({ value, onChange, excludeIds }) {
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
      listProducers({ search: query, limit: 8 })
        .then(d => {
          const filtered = (d.producers || []).filter(p => !excludeIds.includes(p.id))
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
    </div>
  )
}

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

export default function ShowDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [show, setShow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [addProducer, setAddProducer] = useState(null)
  const [addRoleId, setAddRoleId] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const [drawerId, setDrawerId] = useState(null)
  const [productionDrawerId, setProductionDrawerId] = useState(null)
  const [addProdModal, setAddProdModal] = useState(false)
  const [addProdSelection, setAddProdSelection] = useState(null)
  const [addProdSaving, setAddProdSaving] = useState(false)
  const [addProdError, setAddProdError] = useState(null)
  const [removeProdConfirm, setRemoveProdConfirm] = useState(null)
  const [prodPage, setProdPage] = useState(1)
  const [prodLimit, setProdLimit] = useState(25)
  const [psPage, setPsPage] = useState(1)
  const [psLimit, setPsLimit] = useState(25)

  const { values: showRoleValues } = useLookupValues('role', 'producer_show')

  function load() {
    setLoading(true)
    setError(null)
    getShow(id)
      .then(data => {
        if (data.error) setError(data.error)
        else setShow(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  async function handleDelete() {
    try {
      const result = await deleteShow(id)
      if (result.error) {
        setError(result.error)
        setDeleteConfirm(false)
      } else {
        navigate('/producers/shows')
      }
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(false)
    }
  }

  async function handleAddProducer(e) {
    e.preventDefault()
    if (!addProducer) return
    setAddSaving(true)
    setAddError(null)
    try {
      const result = await addProducerToShow(parseInt(id), {
        producer_id: addProducer.id,
        role_id: addRoleId ? parseInt(addRoleId, 10) : null,
      })
      if (result.error) { setAddError(result.error); setAddSaving(false) }
      else { setAddModal(false); setAddProducer(null); setAddRoleId(''); setAddSaving(false); load() }
    } catch (err) {
      setAddError(err.message)
      setAddSaving(false)
    }
  }

  async function handleRemoveProducer() {
    if (!removeConfirm) return
    try {
      await removeProducerFromShow(parseInt(id), removeConfirm.id)
      setRemoveConfirm(null)
      load()
    } catch (err) {
      setError(err.message)
      setRemoveConfirm(null)
    }
  }

  async function handleAddProduction(e) {
    e.preventDefault()
    if (!addProdSelection) return
    setAddProdSaving(true)
    setAddProdError(null)
    try {
      const result = await addShowProduction(parseInt(id), addProdSelection.id)
      if (result.error) { setAddProdError(result.error); setAddProdSaving(false) }
      else { setAddProdModal(false); setAddProdSelection(null); setAddProdSaving(false); load() }
    } catch (err) {
      setAddProdError(err.message)
      setAddProdSaving(false)
    }
  }

  async function handleRemoveProduction() {
    if (!removeProdConfirm) return
    try {
      const result = await removeShowProduction(parseInt(id), removeProdConfirm.id)
      if (result.error) setError(result.error)
      setRemoveProdConfirm(null)
      load()
    } catch (err) {
      setError(err.message)
      setRemoveProdConfirm(null)
    }
  }

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  if (error && !show) {
    return <Alert variant="error" title={error} />
  }

  if (!show) return null

  const productions = show.productions || []
  const existingProductionIds = productions.map(p => p.id)
  const producerShows = show.producer_shows || []
  const existingProducerIds = producerShows.map(ps => ps.producer_id)

  const PRODUCTION_COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Remove', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setRemoveProdConfirm(row) },
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
      key: 'venue', label: 'Venue',
      render: v => v ? v.name : <span className="cell-muted">&mdash;</span>,
    },
    {
      key: 'producers', label: 'Producers', number: true,
      render: v => (v || []).length > 0 ? <span className="cell-strong">{v.length}</span> : null,
    },
  ]

  const PRODUCER_SHOW_COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Remove', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setRemoveConfirm(row) },
        ]} />
      ),
    },
    {
      key: 'last_name', label: 'Name', strong: true,
      render: (_, row) => `${row.last_name}, ${row.first_name}`,
    },
    {
      key: 'role', label: 'Role',
      render: v => v
        ? <span className={`badge ${v.css_class}`}>{v.display_label}</span>
        : null,
    },
  ]

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/shows" className="breadcrumb">Shows</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        <span className="breadcrumb-current">{show.title}</span>
      </div>

      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{show.title}</h1>
          <ActionMenu items={[
            { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/shows/${id}/edit`) },
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
              <div className="type-label">Medium</div>
              {show.medium
                ? <span className={`badge ${show.medium.css_class}`}>{show.medium.display_label}</span>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Original Year</div>
              {show.original_year
                ? <div>{show.original_year}</div>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Work Origin</div>
              {show.work_origin
                ? <span className={`badge ${show.work_origin.css_class}`}>{show.work_origin.display_label}</span>
                : <div className="cell-muted">&mdash;</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="type-label">Description</div>
          <div className="prose">{show.description || <span className="cell-muted">&mdash;</span>}</div>

          {show.genre && (
            <>
              <div className="type-label mt-16">Genre</div>
              <div className="prose">{show.genre}</div>
            </>
          )}

          {show.themes && (
            <>
              <div className="type-label mt-16">Themes</div>
              <div className="prose">{show.themes}</div>
            </>
          )}

          {show.summary && (
            <>
              <div className="type-label mt-16">Summary</div>
              <div className="prose">{show.summary}</div>
            </>
          )}
        </div>
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Productions of {show.title}</h3>
          <span className="section-card-meta">
            {productions.length} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => setAddProdModal(true)}>+ Add</span>
          </span>
        </div>

        <DataTable
          data={productions}
          columns={PRODUCTION_COLUMNS}
          onRowClick={row => setProductionDrawerId(row.id)}
          pagination={{ total: productions.length, page: prodPage, limit: prodLimit, onPageChange: setProdPage, onLimitChange: setProdLimit }}
          emptyState={
            <EmptyState
              title="No productions"
              description="No productions of this show have been recorded yet."
            />
          }
        />
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Producers attached to {show.title}</h3>
          <span className="section-card-meta">
            {producerShows.length} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => setAddModal(true)}>+ Add</span>
          </span>
        </div>

        <DataTable
          data={producerShows}
          columns={PRODUCER_SHOW_COLUMNS}
          onRowClick={row => setDrawerId(row.producer_id)}
          pagination={{ total: producerShows.length, page: psPage, limit: psLimit, onPageChange: setPsPage, onLimitChange: setPsLimit }}
          emptyState={
            <EmptyState
              title="No producers"
              description="No producers are attached to this show yet."
            />
          }
        />
      </div>

      {/* Delete show modal */}
      {deleteConfirm && (
        <Modal title="Delete Show" onClose={() => setDeleteConfirm(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{show.title}</strong>
            {productions.length > 0 && <span> and its {productions.length} production{productions.length !== 1 ? 's' : ''}</span>}
            ? This cannot be undone.
          </p>
        </Modal>
      )}

      {/* Add producer modal */}
      {addModal && (
        <Modal title="Add Producer Relationship" onClose={() => { setAddModal(false); setAddProducer(null); setAddRoleId(''); setAddError(null) }}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { setAddModal(false); setAddProducer(null); setAddRoleId(''); setAddError(null) }}>Cancel</button>
            <button className="btn btn-primary" disabled={addSaving || !addProducer} onClick={handleAddProducer}>
              {addSaving ? 'Adding...' : 'Add'}
            </button>
          </>}>
          {addError && <Alert variant="error" title={addError} />}
          <form onSubmit={handleAddProducer}>
            <div className="form-field">
              <label className="input-label">Producer</label>
              <ProducerSearch value={addProducer} onChange={setAddProducer} excludeIds={existingProducerIds} />
            </div>
            <div className="form-field">
              <label className="input-label">Role</label>
              <div className="select-wrapper">
                <select className="select" value={addRoleId} onChange={e => setAddRoleId(e.target.value)}>
                  <option value="">Select role...</option>
                  {showRoleValues.map(r => <option key={r.id} value={r.id}>{r.display_label}</option>)}
                </select>
                <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Add production modal */}
      {addProdModal && (
        <Modal title="Add Production" onClose={() => { setAddProdModal(false); setAddProdSelection(null); setAddProdError(null) }}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { setAddProdModal(false); setAddProdSelection(null); setAddProdError(null) }}>Cancel</button>
            <button className="btn btn-primary" disabled={addProdSaving || !addProdSelection} onClick={handleAddProduction}>
              {addProdSaving ? 'Adding...' : 'Add'}
            </button>
          </>}>
          {addProdError && <Alert variant="error" title={addProdError} />}
          <form onSubmit={handleAddProduction}>
            <div className="form-field">
              <label className="input-label">Production</label>
              <ProductionSearch value={addProdSelection} onChange={setAddProdSelection} excludeIds={existingProductionIds} />
            </div>
          </form>
        </Modal>
      )}

      {/* Remove production confirmation */}
      {removeProdConfirm && (
        <Modal title="Remove production?" onClose={() => setRemoveProdConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setRemoveProdConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleRemoveProduction}>Remove</button>
          </>}>
          <p className="confirm-body">
            Remove <strong>{removeProdConfirm.title}</strong> from {show.title}? This only removes the link — the production record is not deleted.
          </p>
        </Modal>
      )}

      {/* Production drawer */}
      {productionDrawerId && <ProductionDrawer
        productionId={productionDrawerId}
        onClose={() => setProductionDrawerId(null)}
        onProducerClick={producerId => { setProductionDrawerId(null); setDrawerId(producerId) }}
      />}

      {/* Producer drawer */}
      {drawerId && <ProducerDrawer producerId={drawerId} onClose={() => setDrawerId(null)} />}

      {/* Remove producer confirmation */}
      {removeConfirm && (
        <Modal title="Remove producer?" onClose={() => setRemoveConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setRemoveConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleRemoveProducer}>Remove</button>
          </>}>
          <p className="confirm-body">
            Remove <strong>{removeConfirm.first_name} {removeConfirm.last_name}</strong> from {show.title}? This only removes the IP-level relationship — production credits are not affected.
          </p>
        </Modal>
      )}
    </>
  )
}
