/**
 * Show List — all WN shows, searchable, filterable, sortable.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StageProgression from '@shared/components/StageProgression'
import SelectArrow from '@shared/components/SelectArrow'
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
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    try {
      const [showData, stageData, mediumData] = await Promise.all([
        listShows({
          search: debouncedSearch,
          stage: stageFilter,
          medium: mediumFilter,
          sort,
          sort_dir: sortDir,
          limit: 100,
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
  }, [debouncedSearch, stageFilter, mediumFilter, sort, sortDir])

  useEffect(() => { load() }, [load])

  return (
    <div className="page">
      <div className="page-topbar">
        <div>
          <h1 className="page-title">All Shows</h1>
          <p className="page-subtitle">{total} project{total !== 1 ? 's' : ''} on the slate</p>
        </div>
        <div className="page-topbar-actions">
          <button className="btn btn-primary" onClick={() => navigate('/slate/shows/new')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New Show
          </button>
        </div>
      </div>

      <div className="slate-filter-row">
        <input
          className="input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search shows..."
        />
        <div className="select-wrapper">
          <select className="select" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
            <option value="">All Stages</option>
            {stages.map(s => <option key={s.id} value={s.value}>{s.display_label}</option>)}
          </select>
          <SelectArrow />
        </div>
        <div className="select-wrapper">
          <select className="select" value={mediumFilter} onChange={e => setMediumFilter(e.target.value)}>
            <option value="">All Mediums</option>
            {mediums.map(m => <option key={m.id} value={m.value}>{m.display_label}</option>)}
          </select>
          <SelectArrow />
        </div>
      </div>

      {loading ? (
        <div className="page-loading"><div className="loading-spinner" /></div>
      ) : shows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="32" height="32" rx="4" />
              <path d="M12 20h16M20 12v16" />
            </svg>
          </div>
          <div className="empty-state-title">{debouncedSearch || stageFilter || mediumFilter ? 'No results' : 'No shows yet'}</div>
          <div className="empty-state-desc">
            {debouncedSearch || stageFilter || mediumFilter
              ? 'Try different filters or search terms.'
              : 'Create your first show to start building the slate.'}
          </div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Medium</th>
              <th>Stage</th>
              <th>Current Script</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {shows.map(show => (
              <tr key={show.id} onClick={() => navigate(`/slate/shows/${show.id}/overview`)} className="clickable">
                <td className="cell-strong">{show.title}</td>
                <td>{show.medium && <span className={`badge ${show.medium.css_class || 'badge-neutral'}`}>{show.medium.display_label}</span>}</td>
                <td>
                  {stages.length > 0 && show.development_stage && (
                    <StageProgression stages={stages} currentValue={show.development_stage.value} compact />
                  )}
                </td>
                <td className="text-secondary">{show.current_script_version || '\u2014'}</td>
                <td className="text-secondary">{show.updated_at ? new Date(show.updated_at).toLocaleDateString() : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
