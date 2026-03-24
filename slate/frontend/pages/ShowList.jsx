/**
 * Show List — all WN shows, searchable, filterable, sortable.
 */

import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable, DropdownSelect, EmptyState } from '@shared/components'
import { listShows, getLookupValues } from '@slate/api'

export default function ShowList() {
  const [shows, setShows] = useState([])
  const [total, setTotal] = useState(0)
  const [stages, setStages] = useState([])
  const [mediums, setMediums] = useState([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [mediumFilter, setMediumFilter] = useState('')
  const [sort, setSort] = useState('updated')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [loading, setLoading] = useState(true)
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [showData, stageData, mediumData] = await Promise.all([
        listShows({
          search: debouncedSearch,
          stage: stageFilter,
          medium: mediumFilter,
          sort,
          sort_dir: sortDir,
          limit,
          offset: (page - 1) * limit,
        }),
        getLookupValues({ category: 'development_stage' }),
        getLookupValues({ category: 'medium' }),
      ])
      setShows(showData.shows || [])
      setTotal(showData.total || 0)
      setStages(stageData.lookup_values || [])
      setMediums(mediumData.lookup_values || [])
    } catch (err) {
      console.error('Failed to load shows:', err)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, stageFilter, mediumFilter, sort, sortDir, page, limit])

  useEffect(() => { load() }, [load])

  const stageOptions = [
    { value: '', label: 'All Stages' },
    ...stages.map(s => ({ value: s.value, label: s.display_label })),
  ]

  const mediumOptions = [
    { value: '', label: 'All Mediums' },
    ...mediums.map(m => ({ value: m.value, label: m.display_label })),
  ]

  const columns = [
    {
      key: 'title',
      label: 'Title',
      strong: true,
    },
    {
      key: 'medium',
      label: 'Medium',
      render: (_, row) => row.medium
        ? <span className={`badge ${row.medium.css_class || 'badge-neutral'}`}>{row.medium.display_label}</span>
        : null,
    },
    {
      key: 'development_stage',
      label: 'Stage',
      render: (_, row) => row.development_stage
        ? <span className={`badge ${row.development_stage.css_class || 'badge-neutral'}`}>{row.development_stage.display_label}</span>
        : null,
    },
    {
      key: 'current_script_version',
      label: 'Current Script',
      className: 'cell-muted',
    },
    {
      key: 'updated_at',
      label: 'Updated',
      className: 'cell-muted',
      render: v => v ? new Date(v).toLocaleDateString() : '',
    },
  ]

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h1 className="page-title">All Shows</h1>
          <p className="page-subtitle">{total} project{total !== 1 ? 's' : ''} on the slate</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/slate/shows/new')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 2v10M2 7h10" />
          </svg>
          New Show
        </button>
      </div>

      <div className="filter-row">
        <div className="query-bar">
          <svg className="query-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7.5" cy="7.5" r="5.5" /><path d="M12 12l4 4" />
          </svg>
          <input
            className="query-input"
            placeholder="Search shows..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <DropdownSelect
          options={stageOptions}
          value={stageFilter}
          onChange={v => { setStageFilter(v); setPage(1) }}
          placeholder="All Stages"
        />
        <DropdownSelect
          options={mediumOptions}
          value={mediumFilter}
          onChange={v => { setMediumFilter(v); setPage(1) }}
          placeholder="All Mediums"
        />
      </div>

      {loading ? (
        <div className="page-loading"><div className="loading-spinner" /></div>
      ) : (
        <DataTable
          data={shows}
          columns={columns}
          onRowClick={row => navigate(`/slate/shows/${row.id}/overview`)}
          sort={{ field: sort, dir: sortDir, onSort: (f, d) => { setSort(f); setSortDir(d) } }}
          pagination={{ total, page, limit, onPageChange: setPage, onLimitChange: setLimit }}
          emptyState={
            <EmptyState
              title={debouncedSearch || stageFilter || mediumFilter ? 'No results' : 'No shows yet'}
              description={
                debouncedSearch || stageFilter || mediumFilter
                  ? 'Try different filters or search terms.'
                  : 'Create your first show to start building the slate.'
              }
              action={!debouncedSearch && !stageFilter && !mediumFilter ? (
                <button className="btn btn-primary" onClick={() => navigate('/slate/shows/new')}>New Show</button>
              ) : undefined}
            />
          }
        />
      )}
    </>
  )
}
