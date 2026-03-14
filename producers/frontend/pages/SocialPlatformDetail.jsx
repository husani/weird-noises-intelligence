import React, { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  getSocialPlatform, deleteSocialPlatform,
  addPlatformProducer, removePlatformProducer,
  addPlatformOrg, removePlatformOrg,
  updatePlatformLink,
  listProducers, listOrganizations,
} from '@producers/api'
import { Alert, DataTable, EmptyState, Modal, ActionMenu, ProducerDrawer, PlatformIcon } from '@shared/components'

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
        <span className="cell-strong">{value.last_name}, {value.first_name}</span>
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
              <span className="cell-strong">{p.last_name}, {p.first_name}</span>
              {p.current_organization && <span className="cell-muted"> — {p.current_organization}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Organization search typeahead ── */

function OrgSearch({ value, onChange, excludeIds }) {
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
      listOrganizations({ search: query, limit: 8 })
        .then(d => {
          const filtered = (d.organizations || []).filter(o => !excludeIds.includes(o.id))
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
        <span className="cell-strong">{value.name}</span>
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
          {results.map(o => (
            <div key={o.id} className="producer-search-option" onClick={() => { onChange(o); setOpen(false); setQuery('') }}>
              <span className="cell-strong">{o.name}</span>
              {o.org_type && <span className="cell-muted"> — {o.org_type}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Add link modal (works for both producers and orgs) ── */

function AddLinkModal({ type, platformId, platformBaseUrl, excludeIds, onClose, onSaved }) {
  const [selected, setSelected] = useState(null)
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isProducer = type === 'producer'
  const title = isProducer ? 'Add Producer' : 'Add Organization'

  async function handleSave(e) {
    e.preventDefault()
    if (!selected || !url.trim()) return
    setSaving(true)
    setError(null)
    try {
      const result = isProducer
        ? await addPlatformProducer(platformId, selected.id, url)
        : await addPlatformOrg(platformId, selected.id, url)
      if (result.error) { setError(result.error); setSaving(false) }
      else onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={saving || !selected || !url.trim()} onClick={handleSave}>
          {saving ? 'Adding...' : 'Add'}
        </button>
      </>}>
      {error && <Alert variant="error" title={error} />}
      <form onSubmit={handleSave}>
        <div className="form-field">
          <label className="input-label">{isProducer ? 'Producer' : 'Organization'}</label>
          {isProducer
            ? <ProducerSearch value={selected} onChange={setSelected} excludeIds={excludeIds} />
            : <OrgSearch value={selected} onChange={setSelected} excludeIds={excludeIds} />}
        </div>
        <div className="form-field">
          <label className="input-label">Profile URL</label>
          <input className="input input-full" placeholder={platformBaseUrl || 'https://...'} value={url} onChange={e => setUrl(e.target.value)} />
        </div>
      </form>
    </Modal>
  )
}

/* ── Edit URL modal ── */

function EditUrlModal({ platformId, editLink, onClose, onSaved }) {
  const [url, setUrl] = useState(editLink.url)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    if (!url.trim()) return
    setSaving(true)
    setError(null)
    try {
      const result = await updatePlatformLink(platformId, editLink.type, editLink.id, url)
      if (result.error) { setError(result.error); setSaving(false) }
      else onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Edit URL — ${editLink.name}`} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={saving || !url.trim()} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </>}>
      {error && <Alert variant="error" title={error} />}
      <form onSubmit={handleSave}>
        <div className="form-field">
          <label className="input-label">Profile URL</label>
          <input className="input input-full" value={url} onChange={e => setUrl(e.target.value)} />
        </div>
      </form>
    </Modal>
  )
}

/* ── Main page ── */

export default function SocialPlatformDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [platform, setPlatform] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [addModal, setAddModal] = useState(null) // null | 'producer' | 'org'
  const [editLink, setEditLink] = useState(null) // { type, id, name, url }
  const [removeConfirm, setRemoveConfirm] = useState(null) // { type, id, name }
  const [drawerId, setDrawerId] = useState(null)
  const [prodPage, setProdPage] = useState(1)
  const [prodLimit, setProdLimit] = useState(25)
  const [orgPage, setOrgPage] = useState(1)
  const [orgLimit, setOrgLimit] = useState(25)

  function load() {
    setLoading(true)
    setError(null)
    getSocialPlatform(id)
      .then(data => {
        if (data.error) setError(data.error)
        else setPlatform(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  async function handleDelete() {
    try {
      const result = await deleteSocialPlatform(id)
      if (result.error) {
        setError(result.error)
        setDeleteConfirm(false)
      } else {
        navigate('/producers/social-platforms')
      }
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(false)
    }
  }

  async function handleRemove() {
    if (!removeConfirm) return
    try {
      const result = removeConfirm.type === 'producer'
        ? await removePlatformProducer(id, removeConfirm.id)
        : await removePlatformOrg(id, removeConfirm.id)
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

  if (error && !platform) {
    return <Alert variant="error" title={error} />
  }

  if (!platform) return null

  const producers = platform.producers || []
  const organizations = platform.organizations || []

  const PRODUCER_COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Edit URL', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => setEditLink({ type: 'producer', id: row.id, name: `${row.first_name} ${row.last_name}`, url: row.url || '' }) },
          { divider: true },
          { label: 'Remove', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setRemoveConfirm({ type: 'producer', id: row.id, name: `${row.first_name} ${row.last_name}` }) },
        ]} />
      ),
    },
    {
      key: 'last_name', label: 'Name', strong: true,
      render: (_, row) => `${row.last_name}, ${row.first_name}`,
    },
    {
      key: 'url', label: 'Profile URL',
      render: v => v
        ? <a href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noopener noreferrer" className="link link-external" onClick={e => e.stopPropagation()}>{v.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>
        : null,
      className: 'cell-muted',
    },
  ]

  const ORG_COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Edit URL', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => setEditLink({ type: 'org', id: row.id, name: row.name, url: row.url || '' }) },
          { divider: true },
          { label: 'Remove', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setRemoveConfirm({ type: 'org', id: row.id, name: row.name }) },
        ]} />
      ),
    },
    { key: 'name', label: 'Name', strong: true },
    {
      key: 'url', label: 'Profile URL',
      render: v => v
        ? <a href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noopener noreferrer" className="link link-external" onClick={e => e.stopPropagation()}>{v.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>
        : null,
      className: 'cell-muted',
    },
  ]

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/social-platforms" className="breadcrumb">Social Platforms</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        <span className="breadcrumb-current">{platform.name}</span>
      </div>

      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{platform.name}</h1>
          <ActionMenu items={[
            { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/social-platforms/${id}/edit`) },
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
              <div className="type-label">Icon</div>
              {platform.icon_svg
                ? <PlatformIcon svg={platform.icon_svg} size={32} />
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Base URL</div>
              {platform.base_url
                ? <a href={platform.base_url} target="_blank" rel="noopener noreferrer" className="link link-external">{platform.base_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>
                : <div className="cell-muted">&mdash;</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="type-label">Description</div>
          <div className="prose">{platform.description || 'No description'}</div>
        </div>
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Producers with {platform.name} profiles</h3>
          <span className="section-card-meta">
            {producers.length} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => setAddModal('producer')}>+ Add</span>
          </span>
        </div>

        <DataTable
          data={producers}
          columns={PRODUCER_COLUMNS}
          onRowClick={row => setDrawerId(row.id)}
          pagination={{ total: producers.length, page: prodPage, limit: prodLimit, onPageChange: setProdPage, onLimitChange: setProdLimit }}
          emptyState={
            <EmptyState
              title="No producers"
              description="No producers have profiles on this platform yet."
            />
          }
        />
      </div>

      <div className="section-card mt-32">
        <div className="section-card-header">
          <h3 className="section-card-title">Organizations with {platform.name} profiles</h3>
          <span className="section-card-meta">
            {organizations.length} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => setAddModal('org')}>+ Add</span>
          </span>
        </div>

        <DataTable
          data={organizations}
          columns={ORG_COLUMNS}
          onRowClick={row => navigate(`/producers/organizations/${row.id}`)}
          pagination={{ total: organizations.length, page: orgPage, limit: orgLimit, onPageChange: setOrgPage, onLimitChange: setOrgLimit }}
          emptyState={
            <EmptyState
              title="No organizations"
              description="No organizations have profiles on this platform yet."
            />
          }
        />
      </div>

      {/* Add link modal */}
      {addModal && (
        <AddLinkModal
          type={addModal}
          platformId={parseInt(id)}
          platformBaseUrl={platform.base_url}
          excludeIds={addModal === 'producer' ? producers.map(p => p.id) : organizations.map(o => o.id)}
          onClose={() => setAddModal(null)}
          onSaved={() => { setAddModal(null); load() }}
        />
      )}

      {/* Edit URL modal */}
      {editLink && (
        <EditUrlModal
          platformId={parseInt(id)}
          editLink={editLink}
          onClose={() => setEditLink(null)}
          onSaved={() => { setEditLink(null); load() }}
        />
      )}

      {/* Producer drawer */}
      {drawerId && <ProducerDrawer producerId={drawerId} onClose={() => setDrawerId(null)} />}

      {/* Remove confirmation modal */}
      {removeConfirm && (
        <Modal title={`Remove ${removeConfirm.type === 'producer' ? 'producer' : 'organization'}?`} onClose={() => setRemoveConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setRemoveConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleRemove}>Remove</button>
          </>}>
          <p className="confirm-body">
            Remove <strong>{removeConfirm.name}</strong>&rsquo;s {platform.name} profile link? This only removes the link — the {removeConfirm.type === 'producer' ? 'producer' : 'organization'} record is not deleted.
          </p>
        </Modal>
      )}

      {/* Delete platform modal */}
      {deleteConfirm && (
        <Modal title="Delete Platform" onClose={() => setDeleteConfirm(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{platform.name}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </>
  )
}
