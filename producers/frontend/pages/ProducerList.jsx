import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProducers, listTags, batchRefresh, batchAddTag, deleteProducer } from '@producers/api'
import Modal from '@shared/components/Modal'
import SortHeader from '@shared/components/SortHeader'
import { TableControls } from '@shared/components'

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

export default function ProducerList() {
  const [producers, setProducers] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [allTags, setAllTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [batchAction, setBatchAction] = useState(null)
  const [batchTag, setBatchTag] = useState('')
  const [deleteModal, setDeleteModal] = useState(null)
  const [sort, setSort] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const navigate = useNavigate()
  const [limit, setLimit] = useState(50)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  useEffect(() => {
    listTags().then(setAllTags).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const offset = (page - 1) * limit
    const params = { limit, offset, sort, sort_dir: sortDir }
    if (debouncedSearch) params.search = debouncedSearch
    if (stateFilter) params.state = stateFilter
    if (tagFilter) params.tag = tagFilter
    listProducers(params)
      .then(data => {
        setProducers(data.producers)
        setTotal(data.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [debouncedSearch, stateFilter, tagFilter, page, sort, sortDir])

  useEffect(() => { load() }, [load])

  const allSelected = producers.length > 0 && producers.every(p => selected.has(p.id))

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(producers.map(p => p.id)))
    }
  }

  const [batchRefreshMsg, setBatchRefreshMsg] = useState(null)

  async function handleBatchRefresh() {
    const count = selected.size
    await batchRefresh([...selected])
    setSelected(new Set())
    setBatchAction(null)
    setBatchRefreshMsg(`Dossier refresh queued for ${count} producer${count !== 1 ? 's' : ''}. Research is running in the background.`)
    setTimeout(() => { setBatchRefreshMsg(null); load() }, 6000)
  }

  async function handleBatchTag() {
    if (!batchTag.trim()) return
    await batchAddTag([...selected], batchTag.trim())
    setSelected(new Set())
    setBatchAction(null)
    setBatchTag('')
    load()
  }

  async function handleDelete() {
    if (!deleteModal) return
    await deleteProducer(deleteModal.id)
    setDeleteModal(null)
    load()
  }

  function handleSort(field, dir) { setSort(field); setSortDir(dir) }

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h2 className="page-title">All Producers</h2>
          <p className="page-subtitle">{total > 0 ? `${total} producer${total !== 1 ? 's' : ''} in database` : 'Your producer database'}</p>
        </div>
        <button className="btn btn-primary btn-icon-left" onClick={() => navigate('/producers/add')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 2v10M2 7h10" />
          </svg>
          Add Producer
        </button>
      </div>

      <div className="filter-row">
        <div className="query-bar search-bar-flex">
          <svg className="query-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7.5" cy="7.5" r="5.5" /><path d="M12 12l4 4" />
          </svg>
          <input
            className="query-input"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="select-wrapper">
          <select
            className="select"
            value={stateFilter}
            onChange={e => { setStateFilter(e.target.value); setPage(1) }}
          >
            <option value="">All states</option>
            {Object.entries(STATE_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <span className="select-arrow">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 5l3 3 3-3" />
            </svg>
          </span>
        </div>
        {allTags.length > 0 && (
          <div className="select-wrapper">
            <select
              className="select"
              value={tagFilter}
              onChange={e => { setTagFilter(e.target.value); setPage(1) }}
            >
              <option value="">All tags</option>
              {allTags.map(t => (
                <option key={t.id} value={t.name}>{t.name} ({t.count})</option>
              ))}
            </select>
            <span className="select-arrow">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 5l3 3 3-3" />
              </svg>
            </span>
          </div>
        )}
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="batch-bar">
          <span className="cell-muted">{selected.size} selected</span>
          <button className="btn btn-secondary" onClick={handleBatchRefresh}>
            Refresh Selected
          </button>
          <button className="btn btn-secondary" onClick={() => setBatchAction('tag')}>
            Tag Selected
          </button>
          <button className="btn btn-ghost ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {batchRefreshMsg && (
        <div className="alert alert-info mb-16">
          <div className="loading-spinner spinner-xs" />
          <div className="alert-content">
            <div className="alert-title">{batchRefreshMsg}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="disc-center">
          <div className="loading-spinner" />
        </div>
      ) : producers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No producers found</div>
          <div className="empty-state-desc">
            {search || stateFilter || tagFilter ? 'Try adjusting the search or filters.' : 'Add a producer to get started.'}
          </div>
          {!search && !stateFilter && !tagFilter && (
            <button className="btn btn-primary mt-16" onClick={() => navigate('/producers/add')}>
              Add Producer
            </button>
          )}
        </div>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="checkbox-warm" />
                </th>
                <SortHeader label="Name" field="name" sort={sort} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Organization" field="organization" sort={sort} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Location" field="city" sort={sort} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Relationship" field="last_contact" sort={sort} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Last Updated" field="updated" sort={sort} sortDir={sortDir} onSort={handleSort} />
                <th className="th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {producers.map(p => {
                const state = STATE_LABELS[p.relationship_state] || STATE_LABELS.no_contact
                const showResearch = p.research_status && p.research_status !== 'complete'
                const isOverdue = p.relationship_state === 'overdue'
                return (
                  <tr key={p.id}
                    className={`row-clickable${isOverdue ? ' row-overdue' : ''}`}
                    onClick={(e) => {
                      if (e.target.type === 'checkbox' || e.target.closest('button')) return
                      navigate(`/producers/detail/${p.id}`)
                    }}>
                    <td className="td-checkbox" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="checkbox-warm" />
                    </td>
                    <td>
                      <div className="producer-name-row">
                        <span className="cell-strong">{p.last_name}, {p.first_name}</span>
                        {showResearch && (
                          p.research_status === 'failed'
                            ? <span className="badge badge-rose" title={p.research_status_detail || ''}>research failed</span>
                            : <span className="status status-blue" title={p.research_status_detail || ''}><span className="status-dot pulse" />researching</span>
                        )}
                      </div>
                      {p.tags && p.tags.length > 0 && (
                        <div className="mt-4">
                          {p.tags.slice(0, 3).map(t => (
                            <span key={t} className="tag mr-4">{t}</span>
                          ))}
                          {p.tags.length > 3 && (
                            <span className="badge badge-neutral cursor-default"
                              title={p.tags.slice(3).join(', ')}>+{p.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{p.current_organization || <span className="cell-muted">&mdash;</span>}</td>
                    <td>{p.city || <span className="cell-muted">&mdash;</span>}</td>
                    <td>
                      <div className="producer-status-row">
                        <span className={`status status-${state.variant}`}><span className="status-dot" />{state.label}</span>
                        {p.interaction_count > 0 && (
                          <span className="cell-muted fs-sm" title={`${p.interaction_count} interaction${p.interaction_count !== 1 ? 's' : ''}`}>
                            {p.interaction_count}x
                          </span>
                        )}
                      </div>
                      {p.last_contact_date && (
                        <span className="cell-muted fs-meta mt-2 block">
                          {relativeTime(p.last_contact_date)}
                        </span>
                      )}
                    </td>
                    <td className="cell-muted">
                      {p.updated_at ? relativeTime(p.updated_at) : '\u2014'}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn-icon"
                        onClick={() => setDeleteModal(p)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <TableControls page={page} onPageChange={setPage} limit={limit} onLimitChange={setLimit} total={total} />
        </>
      )}

      {/* Batch tag modal */}
      {batchAction === 'tag' && (
        <Modal title="Tag Selected Producers" onClose={() => setBatchAction(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setBatchAction(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleBatchTag} disabled={!batchTag.trim()}>Apply Tag</button>
          </>}>
          <div className="input-label mb-8">Tag name</div>
          <input className="input input-full" value={batchTag}
            onChange={e => setBatchTag(e.target.value)} autoFocus
            placeholder="Enter tag..." />
        </Modal>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <Modal title="Delete Producer" onClose={() => setDeleteModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteModal(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </>}>
          <div className="prose">
            Permanently delete <strong>{deleteModal.first_name} {deleteModal.last_name}</strong> and all their data? This cannot be undone.
          </div>
        </Modal>
      )}
    </>
  )
}
