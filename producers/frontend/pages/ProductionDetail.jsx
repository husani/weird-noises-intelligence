import React, { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getProductionDetail, deleteProduction, listProducers, addProducerToProduction, updateProducerRole, removeProducerFromProduction } from '@producers/api'
import { ActionMenu, Alert, DataTable, EmptyState, Modal, ProducerDrawer } from '@shared/components'
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
      {open && query.trim() && results.length === 0 && (
        <div className="producer-search-dropdown">
          <div className="producer-search-empty">No producers found</div>
        </div>
      )}
    </div>
  )
}

/* ── Add/Edit producer modal ── */

function ProducerModal({ productionId, link, existingProducerIds, onClose, onSaved }) {
  const isEdit = !!link
  const { values: roleValues } = useLookupValues('role', 'producer_production')
  const [producer, setProducer] = useState(
    isEdit ? { id: link.producer_id, first_name: link.first_name, last_name: link.last_name } : null
  )
  const [roleId, setRoleId] = useState(link?.role?.id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    if (!producer) return
    setSaving(true)
    setError(null)
    try {
      const payload = { producer_id: producer.id, role_id: roleId ? parseInt(roleId, 10) : null }
      if (isEdit) {
        await updateProducerRole(productionId, link.link_id, payload)
      } else {
        await addProducerToProduction(productionId, payload)
      }
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Producer Role' : 'Add Producer'} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={saving || !producer} onClick={handleSave}>
          {saving ? 'Saving...' : isEdit ? 'Save' : 'Add'}
        </button>
      </>}>
      {error && <Alert variant="error" title={error} />}
      <form onSubmit={handleSave}>
        <div className="form-field">
          <label className="input-label">Producer</label>
          {isEdit
            ? <div className="cell-strong">{link.last_name}, {link.first_name}</div>
            : <ProducerSearch value={producer} onChange={setProducer} excludeIds={existingProducerIds} />}
        </div>
        <div className="form-field">
          <label className="input-label">Role</label>
          <div className="select-wrapper">
            <select className="select" value={roleId} onChange={e => setRoleId(e.target.value)}>
              <option value="">Select...</option>
              {roleValues.map(r => <option key={r.id} value={r.id}>{r.display_label}</option>)}
            </select>
            <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
          </div>
        </div>
      </form>
    </Modal>
  )
}

/* ── Main page ── */

export default function ProductionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [production, setProduction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [producerModal, setProducerModal] = useState(null) // null | 'add' | link object
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const [drawerId, setDrawerId] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)

  function load() {
    setLoading(true)
    setError(null)
    getProductionDetail(id)
      .then(data => {
        if (data.error) setError(data.error)
        else setProduction(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  async function handleDelete() {
    try {
      const result = await deleteProduction(id)
      if (result.error) {
        setError(result.error)
        setDeleteConfirm(false)
      } else {
        const showId = production?.show?.id
        navigate(showId ? `/producers/shows/${showId}` : '/producers/shows')
      }
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(false)
    }
  }

  async function handleRemove() {
    if (!removeConfirm) return
    try {
      const result = await removeProducerFromProduction(parseInt(id), removeConfirm.link_id)
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

  if (error && !production) {
    return <Alert variant="error" title={error} />
  }

  if (!production) return null

  const producers = production.producers || []
  const venue = production.venue
  const existingProducerIds = producers.map(p => p.producer_id)

  const PRODUCER_COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Edit role', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => setProducerModal(row) },
          { divider: true },
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
        : <span className="cell-muted">&mdash;</span>,
    },
  ]

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/shows" className="breadcrumb">Shows</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        {production.show && (
          <>
            <Link to={`/producers/shows/${production.show.id}`} className="breadcrumb">{production.show.title}</Link>
            <span className="breadcrumb-sep">&rsaquo;</span>
          </>
        )}
        <span className="breadcrumb-current">{production.year ? `${production.year} Production` : 'Production'}</span>
      </div>

      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{production.title}{production.year ? ` (${production.year})` : ''}</h1>
          <ActionMenu items={[
            { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/productions/${id}/edit`) },
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
              <div className="type-label">Show</div>
              {production.show
                ? <div>
                    <div>{production.show.title}</div>
                    {production.show.medium && (
                      <span className={`badge ${production.show.medium.css_class}`}>{production.show.medium.display_label}</span>
                    )}
                    {production.show.original_year && (
                      <div className="cell-muted">Original year: {production.show.original_year}</div>
                    )}
                  </div>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Year</div>
              {production.year
                ? <div>{production.year}</div>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Scale</div>
              {production.scale
                ? <span className={`badge ${production.scale.css_class}`}>{production.scale.display_label}</span>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Run Length</div>
              {production.run_length
                ? <div>{production.run_length}</div>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Dates</div>
              {production.start_date || production.end_date
                ? <div>{[production.start_date, production.end_date].filter(Boolean).join(' — ')}</div>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Venue</div>
              {venue
                ? <div>
                    <Link to={`/producers/venues/${venue.id}`} className="link">{venue.name}</Link>
                    {[venue.city, venue.state_region, venue.country].filter(Boolean).length > 0 && (
                      <div className="cell-muted">{[venue.city, venue.state_region, venue.country].filter(Boolean).join(', ')}</div>
                    )}
                  </div>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            {production.production_type && (
              <div className="sidebar-field">
                <div className="type-label">Production Type</div>
                <span className={`badge ${production.production_type.css_class}`}>{production.production_type.display_label}</span>
              </div>
            )}

            {production.capitalization != null && (
              <div className="sidebar-field">
                <div className="type-label">Capitalization</div>
                <div>${production.capitalization.toLocaleString()}</div>
              </div>
            )}

            {production.budget_tier && (
              <div className="sidebar-field">
                <div className="type-label">Budget Tier</div>
                <span className={`badge ${production.budget_tier.css_class}`}>{production.budget_tier.display_label}</span>
              </div>
            )}

            {production.recouped != null && (
              <div className="sidebar-field">
                <div className="type-label">Recouped</div>
                <div>{production.recouped ? 'Yes' : 'No'}</div>
              </div>
            )}

            {production.funding_type && (
              <div className="sidebar-field">
                <div className="type-label">Funding Type</div>
                <span className={`badge ${production.funding_type.css_class}`}>{production.funding_type.display_label}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="type-label">Description</div>
          <div className="prose">{production.description || 'No description'}</div>
        </div>
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Producers on {production.title}</h3>
          <span className="section-card-meta">
            {producers.length} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => setProducerModal('add')}>+ Add</span>
          </span>
        </div>

        <DataTable
          data={producers}
          columns={PRODUCER_COLUMNS}
          rowKey="link_id"
          onRowClick={row => setDrawerId(row.producer_id)}
          pagination={{ total: producers.length, page, limit, onPageChange: setPage, onLimitChange: setLimit }}
          emptyState={
            <EmptyState
              title="No producers"
              description="No producers are currently linked to this production."
            />
          }
        />
      </div>

      {/* Delete production modal */}
      {deleteConfirm && (
        <Modal title="Delete Production" onClose={() => setDeleteConfirm(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{production.title}</strong>
            {producers.length > 0 && <span> and unlink it from {producers.length} producer{producers.length !== 1 ? 's' : ''}</span>}
            ? This cannot be undone.
          </p>
        </Modal>
      )}

      {/* Producer drawer */}
      {drawerId && <ProducerDrawer producerId={drawerId} onClose={() => setDrawerId(null)} />}

      {/* Add/edit producer modal */}
      {producerModal && (
        <ProducerModal
          productionId={parseInt(id)}
          link={producerModal === 'add' ? null : producerModal}
          existingProducerIds={existingProducerIds}
          onClose={() => setProducerModal(null)}
          onSaved={() => { setProducerModal(null); load() }}
        />
      )}

      {/* Remove producer confirmation */}
      {removeConfirm && (
        <Modal title="Remove producer?" onClose={() => setRemoveConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setRemoveConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleRemove}>Remove</button>
          </>}>
          <p className="confirm-body">
            Remove <strong>{removeConfirm.first_name} {removeConfirm.last_name}</strong> from {production.title}? This only removes the link — the producer record is not deleted.
          </p>
        </Modal>
      )}
    </>
  )
}
