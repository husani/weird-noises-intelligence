import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listSocialPlatforms, deleteSocialPlatform } from '@producers/api'
import { ActionMenu, Alert, DataTable, EmptyState, Modal, PlatformIcon } from '@shared/components'

export default function SocialPlatformsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // null | platform object

  function load() {
    setLoading(true)
    setError(null)
    listSocialPlatforms()
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleDelete() {
    if (!deleteConfirm) return
    try {
      const result = await deleteSocialPlatform(deleteConfirm.id)
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

  const filtered = search.trim()
    ? items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : items

  const COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/social-platforms/${row.id}/edit`) },
          { divider: true },
          { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setDeleteConfirm(row) },
        ]} />
      ),
    },
    {
      key: 'icon_svg', label: 'Icon', sortable: false,
      render: v => v ? <PlatformIcon svg={v} size={16} /> : <span className="cell-muted">&mdash;</span>,
    },
    { key: 'name', label: 'Name', strong: true },
    {
      key: 'base_url', label: 'Base URL',
      render: v => v
        ? <a href={v} target="_blank" rel="noopener noreferrer" className="link link-external" onClick={e => e.stopPropagation()}>{v.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>
        : null,
      className: 'cell-muted',
    },
    { key: 'description', label: 'Description', className: 'cell-muted' },
    { key: 'producer_count', label: 'Producers', number: true },
    { key: 'organization_count', label: 'Organizations', number: true },
  ]

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h1 className="page-title">Social Platforms</h1>
          <p className="page-subtitle">{items.length > 0 ? `${items.length} platform${items.length !== 1 ? 's' : ''}` : 'Platforms and profile directories'}</p>
        </div>
        <div className="page-topbar-actions">
          <Link to="/producers/social-platforms/new" className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Add Platform
          </Link>
        </div>
      </div>

      <p className="page-lede">Manage the platforms and profile directories available for linking to producers and organizations.</p>

      <div className="filter-row-compact">
        <div className="query-bar search-bar-constrained">
          <svg className="query-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7.5" cy="7.5" r="5.5" /><path d="M12 12l4 4" />
          </svg>
          <input className="query-input" placeholder="Search platforms..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <Alert variant="error" title={error} />}

      {loading ? (
        <div className="disc-center"><div className="loading-spinner" /></div>
      ) : (
        <DataTable
          data={filtered}
          columns={COLUMNS}
          onRowClick={row => navigate(`/producers/social-platforms/${row.id}`)}
          pagination={{ total: filtered.length, page, limit, onPageChange: setPage, onLimitChange: setLimit }}
          emptyState={
            <EmptyState
              title="No platforms found"
              description={search ? 'Try a different search.' : 'Add social platforms to link profiles to producers and organizations.'}
            />
          }
        />
      )}

      {deleteConfirm && (
        <Modal title="Delete Platform" onClose={() => setDeleteConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </>
  )
}
