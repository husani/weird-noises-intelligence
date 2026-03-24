import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProducers, listTags, batchRefresh, batchAddTag, deleteProducer } from '@producers/api'
import { Alert, DataTable, DropdownSelect, EmptyState, Modal, StatusIndicator } from '@shared/components'

const STATE_OPTIONS = [
  { value: '', label: 'All states' },
  { value: 'no_contact', label: 'No contact' },
  { value: 'new', label: 'New' },
  { value: 'active', label: 'Active' },
  { value: 'gone_cold', label: 'Gone cold' },
]

const STATE_VARIANTS = {
  no_contact: 'neutral',
  new: 'blue',
  active: 'sage',
  gone_cold: 'neutral',
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
  const [limit, setLimit] = useState(50)
  const [selected, setSelected] = useState(new Set())
  const [sort, setSort] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [batchTagModal, setBatchTagModal] = useState(false)
  const [batchTag, setBatchTag] = useState('')
  const [batchRefreshMsg, setBatchRefreshMsg] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
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
    setError(null)
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
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [debouncedSearch, stateFilter, tagFilter, page, sort, sortDir, limit])

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
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(producers.map(p => p.id)))
  }

  async function handleBatchRefresh() {
    const count = selected.size
    try {
      await batchRefresh([...selected])
      setSelected(new Set())
      setBatchRefreshMsg(`Dossier refresh queued for ${count} producer${count !== 1 ? 's' : ''}.`)
      setTimeout(() => { setBatchRefreshMsg(null); load() }, 6000)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleBatchTag() {
    if (!batchTag.trim()) return
    try {
      await batchAddTag([...selected], batchTag.trim())
      setSelected(new Set())
      setBatchTagModal(false)
      setBatchTag('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    if (!deleteModal) return
    try {
      await deleteProducer(deleteModal.id)
      setDeleteModal(null)
      load()
    } catch (err) {
      setError(err.message)
      setDeleteModal(null)
    }
  }

  const tagOptions = [
    { value: '', label: 'All tags' },
    ...allTags.map(t => ({ value: t.name, label: `${t.name} (${t.count})` })),
  ]

  const columns = [
    {
      key: '_select',
      label: '',
      sortable: false,
      className: 'cell-checkbox',
      renderHeader: () => (
        <input type="checkbox" className="checkbox" checked={allSelected} onChange={toggleAll} />
      ),
      render: (_, row) => (
        <input
          type="checkbox"
          className="checkbox"
          checked={selected.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          onClick={e => e.stopPropagation()}
        />
      ),
    },
    {
      key: 'name',
      label: 'Name',
      strong: true,
      render: (_, row) => `${row.last_name}, ${row.first_name}`,
    },
    {
      key: 'current_organization',
      label: 'Organization',
    },
    {
      key: 'city',
      label: 'Location',
      render: (_, row) => {
        const parts = [row.city, row.state_region, row.country].filter(Boolean)
        return parts.length > 0 ? parts.join(', ') : null
      },
    },
    {
      key: 'last_contact',
      label: 'Relationship',
      render: (_, row) => {
        const variant = STATE_VARIANTS[row.relationship_state] || 'neutral'
        const label = STATE_OPTIONS.find(s => s.value === row.relationship_state)?.label || 'No contact'
        return <StatusIndicator variant={variant}>{label}</StatusIndicator>
      },
    },
    {
      key: 'updated',
      label: 'Updated',
      className: 'cell-muted',
      render: (_, row) => row.updated_at ? relativeTime(row.updated_at) : null,
    },
  ]

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h1 className="page-title">All Producers</h1>
          <p className="page-subtitle">
            {total > 0 ? `${total} producer${total !== 1 ? 's' : ''} in database` : 'Your producer database'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/producers/add')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 2v10M2 7h10" />
          </svg>
          Add Producer
        </button>
      </div>

      <div className="filter-row">
        <div className="query-bar">
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
        <DropdownSelect
          options={STATE_OPTIONS}
          value={stateFilter}
          onChange={v => { setStateFilter(v); setPage(1) }}
          placeholder="All states"
        />
        {allTags.length > 0 && (
          <DropdownSelect
            options={tagOptions}
            value={tagFilter}
            onChange={v => { setTagFilter(v); setPage(1) }}
            placeholder="All tags"
            searchable
          />
        )}
      </div>

      {selected.size > 0 && (
        <div className="batch-bar">
          <span className="batch-bar-count">{selected.size} selected</span>
          <button className="btn btn-secondary" onClick={handleBatchRefresh}>
            Refresh Selected
          </button>
          <button className="btn btn-secondary" onClick={() => setBatchTagModal(true)}>
            Tag Selected
          </button>
          <div className="batch-bar-spacer" />
          <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {batchRefreshMsg && (
        <Alert variant="info" title={batchRefreshMsg} />
      )}

      {error && <Alert variant="error" title={error} />}

      {loading ? (
        <div className="page-loading"><div className="loading-spinner" /></div>
      ) : (
        <DataTable
          data={producers}
          columns={columns}
          onRowClick={row => navigate(`/producers/detail/${row.id}`)}
          sort={{ field: sort, dir: sortDir, onSort: (f, d) => { setSort(f); setSortDir(d) } }}
          pagination={{ total, page, limit, onPageChange: setPage, onLimitChange: setLimit }}
          emptyState={
            <EmptyState
              title="No producers found"
              description={
                search || stateFilter || tagFilter
                  ? 'Try adjusting the search or filters.'
                  : 'Add a producer to get started.'
              }
              action={!search && !stateFilter && !tagFilter ? (
                <button className="btn btn-primary" onClick={() => navigate('/producers/add')}>
                  Add Producer
                </button>
              ) : undefined}
            />
          }
        />
      )}

      {batchTagModal && (
        <Modal title="Tag Selected Producers" onClose={() => setBatchTagModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setBatchTagModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleBatchTag} disabled={!batchTag.trim()}>Apply Tag</button>
          </>}>
          <div className="field-stack">
            <div>
              <label className="input-label">Tag name</label>
              <input className="input" value={batchTag}
                onChange={e => setBatchTag(e.target.value)} autoFocus
                placeholder="Enter tag..." />
            </div>
          </div>
        </Modal>
      )}

      {deleteModal && (
        <Modal title="Delete Producer" onClose={() => setDeleteModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteModal(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{deleteModal.first_name} {deleteModal.last_name}</strong> and all their data? This cannot be undone.
          </p>
        </Modal>
      )}
    </>
  )
}
