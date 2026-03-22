import React, { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getShow, deleteShow, deleteProduction, listProducers, addProducerToShow, removeProducerFromShow, removeProducerFromProduction, addProducerToProduction, researchShow } from '@producers/api'
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
  const [deleteProdConfirm, setDeleteProdConfirm] = useState(null)
  const [prodPage, setProdPage] = useState(1)
  const [prodLimit, setProdLimit] = useState(25)
  const [psPage, setPsPage] = useState(1)
  const [psLimit, setPsLimit] = useState(25)
  const [addProdModal, setAddProdModal] = useState(false)
  const [addProdProducer, setAddProdProducer] = useState(null)
  const [addProdProductionId, setAddProdProductionId] = useState('')
  const [addProdRoleId, setAddProdRoleId] = useState('')
  const [addProdSaving, setAddProdSaving] = useState(false)
  const [addProdError, setAddProdError] = useState(null)
  const [researching, setResearching] = useState(false)
  const [synopsisExpanded, setSynopsisExpanded] = useState(false)

  const { values: showRoleValues } = useLookupValues('role', 'producer_show')
  const { values: prodRoleValues } = useLookupValues('role', 'producer_production')

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

  async function handleResearch() {
    setResearching(true)
    setError(null)
    try {
      const result = await researchShow(id)
      if (result.status === 'error') setError(result.error)
      else load()
    } catch (err) {
      setError(err.message)
    } finally {
      setResearching(false)
    }
  }

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
      if (removeConfirm.source === 'show') {
        await removeProducerFromShow(parseInt(id), removeConfirm.link_id)
      } else {
        await removeProducerFromProduction(removeConfirm.production_id, removeConfirm.link_id)
      }
      setRemoveConfirm(null)
      load()
    } catch (err) {
      setError(err.message)
      setRemoveConfirm(null)
    }
  }

  async function handleAddProducerToProduction(e) {
    e.preventDefault()
    if (!addProdProducer || !addProdProductionId) return
    setAddProdSaving(true)
    setAddProdError(null)
    try {
      const result = await addProducerToProduction(parseInt(addProdProductionId), {
        producer_id: addProdProducer.id,
        role_id: addProdRoleId ? parseInt(addProdRoleId, 10) : null,
      })
      if (result.error) { setAddProdError(result.error); setAddProdSaving(false) }
      else { setAddProdModal(false); setAddProdProducer(null); setAddProdProductionId(''); setAddProdRoleId(''); setAddProdSaving(false); load() }
    } catch (err) {
      setAddProdError(err.message)
      setAddProdSaving(false)
    }
  }

  async function handleDeleteProduction() {
    if (!deleteProdConfirm) return
    try {
      const result = await deleteProduction(deleteProdConfirm.id)
      if (result.error) setError(result.error)
      setDeleteProdConfirm(null)
      load()
    } catch (err) {
      setError(err.message)
      setDeleteProdConfirm(null)
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
  const producerShows = show.producer_shows || []
  const existingProducerIds = producerShows.map(ps => ps.producer_id)

  // Build unified producers list from both IP-level and production-level relationships
  const allProducers = (() => {
    const rows = []
    // IP-level (ProducerShow)
    for (const ps of producerShows) {
      rows.push({
        _key: `show-${ps.id}`,
        link_id: ps.id,
        producer_id: ps.producer_id,
        first_name: ps.first_name,
        last_name: ps.last_name,
        role: ps.role,
        source: 'show',
        source_label: 'Show',
        production_id: null,
      })
    }
    // Production-level (ProducerProduction)
    for (const prod of productions) {
      for (const pp of (prod.producers || [])) {
        const detail = [prod.year, prod.scale?.display_label, prod.venue?.name].filter(Boolean).join(' · ')
        rows.push({
          _key: `prod-${pp.link_id}`,
          link_id: pp.link_id,
          producer_id: pp.producer_id,
          first_name: pp.first_name,
          last_name: pp.last_name,
          role: pp.role,
          source: 'production',
          source_label: detail ? `Production · ${detail}` : 'Production',
          production_id: prod.id,
        })
      }
    }
    return rows
  })()

  const PRODUCTION_COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/productions/${row.id}/edit`) },
          { divider: true },
          { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setDeleteProdConfirm(row) },
        ]} />
      ),
    },
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

  const PRODUCER_COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: row.source === 'show' ? 'Remove from show' : 'Remove from production',
            icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4',
            destructive: true, onClick: () => setRemoveConfirm(row) },
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
    {
      key: 'source_label', label: 'Relationship',
      render: (v, row) => row.source === 'show'
        ? <span className="badge badge-warm">Show</span>
        : <span className="badge badge-blue">{v}</span>,
    },
  ]

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/shows" className="breadcrumb">Shows</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        <span className="breadcrumb-current">{show.title}</span>
      </div>

      <div className="page-topbar">
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
        <div className="page-topbar-actions">
          <button className="btn btn-secondary btn-refresh" onClick={handleResearch} disabled={researching}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
            </svg>
            {researching ? 'Researching...' : 'Research'}
          </button>
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

            <div className="sidebar-field">
              <div className="type-label">Genre</div>
              <div className="prose">{show.genre || <span className="cell-muted">&mdash;</span>}</div>
            </div>

            <div className="sidebar-field">
              <div className="type-label">Themes</div>
              <div className="prose">{show.themes || <span className="cell-muted">&mdash;</span>}</div>
            </div>
          </div>
        </div>

        <div>
          <div className="type-label">Description</div>
          <div className="prose">{show.description || <span className="cell-muted">&mdash;</span>}</div>

          <div className="type-label mt-16">Summary</div>
          <div className="prose">{show.summary || <span className="cell-muted">&mdash;</span>}</div>

          <div className="type-label mt-16">Plot Synopsis</div>
          {show.plot_synopsis ? (
            <div className="prose">
              {synopsisExpanded || show.plot_synopsis.length <= 300
                ? show.plot_synopsis
                : show.plot_synopsis.slice(0, 300) + '...'}
              {show.plot_synopsis.length > 300 && (
                <button className="btn-link ml-8" onClick={() => setSynopsisExpanded(!synopsisExpanded)}>
                  {synopsisExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          ) : (
            <div className="prose"><span className="cell-muted">&mdash;</span></div>
          )}
        </div>
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Producers</h3>
          <span className="section-card-meta">
            {allProducers.length} total
            <span className="link ml-12" onClick={() => setAddModal(true)}>+ Add to show</span>
            <span className="link ml-12" onClick={() => setAddProdModal(true)}>+ Add to production</span>
          </span>
        </div>

        <DataTable
          data={allProducers}
          columns={PRODUCER_COLUMNS}
          rowKey="_key"
          onRowClick={row => setDrawerId(row.producer_id)}
          pagination={{ total: allProducers.length, page: psPage, limit: psLimit, onPageChange: setPsPage, onLimitChange: setPsLimit }}
          emptyState={
            <EmptyState
              title="No producers"
              description="No producers are connected to this show or its productions yet."
            />
          }
        />
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Productions of {show.title}</h3>
          <span className="section-card-meta">
            {productions.length} total
            <Link to={`/producers/productions/new?show_id=${id}`} className="link ml-12">+ Add</Link>
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
        <Modal title="Add Producer to Show" onClose={() => { setAddModal(false); setAddProducer(null); setAddRoleId(''); setAddError(null) }}
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

      {/* Add producer to production modal */}
      {addProdModal && (
        <Modal title="Add Producer to Production" onClose={() => { setAddProdModal(false); setAddProdProducer(null); setAddProdProductionId(''); setAddProdRoleId(''); setAddProdError(null) }}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { setAddProdModal(false); setAddProdProducer(null); setAddProdProductionId(''); setAddProdRoleId(''); setAddProdError(null) }}>Cancel</button>
            <button className="btn btn-primary" disabled={addProdSaving || !addProdProducer || !addProdProductionId} onClick={handleAddProducerToProduction}>
              {addProdSaving ? 'Adding...' : 'Add'}
            </button>
          </>}>
          {addProdError && <Alert variant="error" title={addProdError} />}
          <form onSubmit={handleAddProducerToProduction}>
            <div className="form-field">
              <label className="input-label">Production</label>
              <div className="select-wrapper">
                <select className="select" value={addProdProductionId} onChange={e => setAddProdProductionId(e.target.value)}>
                  <option value="">Select production...</option>
                  {productions.map(p => (
                    <option key={p.id} value={p.id}>
                      {[p.year, p.venue?.name, p.scale?.display_label].filter(Boolean).join(' · ') || `Production #${p.id}`}
                    </option>
                  ))}
                </select>
                <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
              </div>
            </div>
            <div className="form-field">
              <label className="input-label">Producer</label>
              <ProducerSearch value={addProdProducer} onChange={setAddProdProducer} excludeIds={[]} />
            </div>
            <div className="form-field">
              <label className="input-label">Role</label>
              <div className="select-wrapper">
                <select className="select" value={addProdRoleId} onChange={e => setAddProdRoleId(e.target.value)}>
                  <option value="">Select role...</option>
                  {prodRoleValues.map(r => <option key={r.id} value={r.id}>{r.display_label}</option>)}
                </select>
                <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete production confirmation */}
      {deleteProdConfirm && (
        <Modal title="Delete Production" onClose={() => setDeleteProdConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteProdConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDeleteProduction}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete this {deleteProdConfirm.year ? deleteProdConfirm.year + ' ' : ''}production of <strong>{show.title}</strong>? This cannot be undone.
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
            {removeConfirm.source === 'show'
              ? <>Remove <strong>{removeConfirm.first_name} {removeConfirm.last_name}</strong> from {show.title}? This only removes the IP-level relationship — production credits are not affected.</>
              : <>Remove <strong>{removeConfirm.first_name} {removeConfirm.last_name}</strong> from the {removeConfirm.source_label} production?</>
            }
          </p>
        </Modal>
      )}
    </>
  )
}
