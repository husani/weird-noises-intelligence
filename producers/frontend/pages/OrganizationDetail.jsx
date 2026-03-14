import React, { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getOrganization, deleteOrganization, listProducers, addAffiliation, updateAffiliation, removeAffiliation } from '@producers/api'
import { ActionMenu, Alert, DataTable, EmptyState, Modal, PlatformIcon, ProducerDrawer } from '@shared/components'

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

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function tenure(start, end) {
  const s = formatDate(start)
  const e = formatDate(end)
  if (!s && !e) return null
  if (s && !e) return `${s} — present`
  if (!s && e) return `— ${e}`
  return `${s} — ${e}`
}

/* ── Producer search typeahead ── */

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

/* ── Affiliation modal ── */

function AffiliationModal({ orgId, affiliation, existingProducerIds, onClose, onSaved }) {
  const isEdit = !!affiliation
  const [producer, setProducer] = useState(
    isEdit ? { id: affiliation.producer_id, first_name: affiliation.first_name, last_name: affiliation.last_name } : null
  )
  const [form, setForm] = useState({
    role_title: affiliation?.role_title || '',
    start_date: affiliation?.start_date || '',
    end_date: affiliation?.end_date || '',
    notes: affiliation?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    if (!producer) return
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateAffiliation(affiliation.producer_id, affiliation.affiliation_id, form)
      } else {
        await addAffiliation(producer.id, { organization_id: parseInt(orgId), ...form })
      }
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Affiliation' : 'Add Producer'} onClose={onClose}
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
            ? <div className="cell-strong">{affiliation.last_name}, {affiliation.first_name}</div>
            : <ProducerSearch value={producer} onChange={setProducer} excludeIds={existingProducerIds} />}
        </div>
        <div className="form-field">
          <label className="input-label">Role</label>
          <input className="input input-full" placeholder="e.g. Artistic Director, Producer..." value={form.role_title} onChange={e => setForm(prev => ({ ...prev, role_title: e.target.value }))} />
        </div>
        <div className="form-grid-2col">
          <div className="form-field">
            <label className="input-label">Start date</label>
            <input type="date" className="input input-full" value={form.start_date} onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))} />
          </div>
          <div className="form-field">
            <label className="input-label">End date</label>
            <input type="date" className="input input-full" value={form.end_date} onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-field">
          <label className="input-label">Notes</label>
          <textarea className="textarea input-full" placeholder="Any context about this affiliation..." value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
        </div>
      </form>
    </Modal>
  )
}

/* ── Main page ── */

export default function OrganizationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [affiliationModal, setAffiliationModal] = useState(null) // null | 'add' | affiliation object
  const [removeConfirm, setRemoveConfirm] = useState(null) // null | affiliation object
  const [drawerId, setDrawerId] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)

  function load() {
    setLoading(true)
    setError(null)
    getOrganization(id)
      .then(data => {
        if (data.error) setError(data.error)
        else setOrg(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  async function handleDelete() {
    try {
      await deleteOrganization(id)
      navigate('/producers/organizations')
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(false)
    }
  }

  async function handleRemove(aff) {
    try {
      await removeAffiliation(aff.producer_id, aff.affiliation_id)
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

  if (error) {
    return <Alert variant="error" title={error} />
  }

  if (!org) return null

  const producers = org.producers || []
  const existingProducerIds = producers.map(p => p.producer_id)

  const PRODUCER_COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Edit affiliation', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => setAffiliationModal(row) },
          { divider: true },
          { label: 'Remove', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setRemoveConfirm(row) },
        ]} />
      ),
    },
    {
      key: 'last_name', label: 'Name', strong: true,
      render: (_, row) => `${row.last_name}, ${row.first_name}`,
    },
    { key: 'role_title', label: 'Role' },
    {
      key: 'tenure', label: 'Tenure',
      render: (_, row) => tenure(row.start_date, row.end_date) || <span className="cell-muted">&mdash;</span>,
      className: 'cell-muted',
    },
    {
      key: 'relationship_state', label: 'WN Relationship',
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
        <Link to="/producers/organizations" className="breadcrumb">Organizations</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{org.name}</span>
      </div>

      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{org.name}</h1>
          <ActionMenu items={[
            { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/organizations/${id}/edit`) },
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
              <div className="type-label">Type</div>
              {org.org_type
                ? <span className={`badge ${org.org_type.css_class}`}>{org.org_type.display_label}</span>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Location</div>
              {[org.city, org.state_region, org.country].filter(Boolean).length > 0
                ? <div>{[org.city, org.state_region, org.country].filter(Boolean).join(', ')}</div>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Website</div>
              {org.website
                ? <a
                    href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-external"
                  >
                    {org.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Profiles</div>
              {(org.social_links || []).length > 0
                ? <div className="social-links-list">
                    {org.social_links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-external social-link-with-icon"
                      >
                        <PlatformIcon svg={link.icon_svg} />
                        {link.platform_name}
                      </a>
                    ))}
                  </div>
                : <div className="cell-muted">&mdash;</div>}
            </div>

          </div>
        </div>

        <div>
          <div className="type-label">Description</div>
          <div className="prose">{org.description || 'No description'}</div>
        </div>
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Producers connected to {org.name}</h3>
          <span className="section-card-meta">
            {producers.length} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => setAffiliationModal('add')}>+ Add</span>
          </span>
        </div>

        <DataTable
          data={producers}
          columns={PRODUCER_COLUMNS}
          rowKey="affiliation_id"
          onRowClick={row => setDrawerId(row.producer_id)}
          pagination={{ total: producers.length, page, limit, onPageChange: setPage, onLimitChange: setLimit }}
          emptyState={
            <EmptyState
              title="No producers"
              description="No producers are currently connected to this organization."
            />
          }
        />
      </div>

      {/* Delete org modal */}
      {deleteConfirm && (
        <Modal title="Delete Organization" onClose={() => setDeleteConfirm(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{org.name}</strong>
            {producers.length > 0 && <span> and unlink it from {producers.length} producer{producers.length !== 1 ? 's' : ''}</span>}
            ? This cannot be undone.
          </p>
        </Modal>
      )}

      {/* Add/edit affiliation modal */}
      {affiliationModal && (
        <AffiliationModal
          orgId={id}
          affiliation={affiliationModal === 'add' ? null : affiliationModal}
          existingProducerIds={existingProducerIds}
          onClose={() => setAffiliationModal(null)}
          onSaved={() => { setAffiliationModal(null); load() }}
        />
      )}

      {/* Producer drawer */}
      {drawerId && <ProducerDrawer producerId={drawerId} onClose={() => setDrawerId(null)} />}

      {/* Remove affiliation modal */}
      {removeConfirm && (
        <Modal title="Remove producer?" onClose={() => setRemoveConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setRemoveConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={() => handleRemove(removeConfirm)}>Remove</button>
          </>}>
          <p className="confirm-body">
            Remove <strong>{removeConfirm.first_name} {removeConfirm.last_name}</strong> from {org.name}? This only removes the affiliation — the producer record is not deleted.
          </p>
        </Modal>
      )}
    </>
  )
}
