/**
 * Options — lookup value management for Slate.
 * Two-panel workbench: category nav on left, data table on right.
 * Same pattern as Producers OptionsPage.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ActionMenu, Alert, DataTable, EmptyState, Modal } from '@shared/components'
import { getLookupValues, deleteLookupValue, reorderLookupValues } from '@slate/api'

const NAV_SECTIONS = [
  {
    label: 'Shows',
    groups: [
      { category: 'medium', entity_type: 'show', label: 'Medium' },
      { category: 'development_stage', entity_type: 'show', label: 'Development Stage' },
      { category: 'rights_status', entity_type: 'show', label: 'Rights Status' },
    ],
  },
  {
    label: 'Content',
    groups: [
      { category: 'track_type', entity_type: 'music_file', label: 'Track Type' },
      { category: 'data_type', entity_type: 'show_data', label: 'Data Type' },
      { category: 'milestone_type', entity_type: 'milestone', label: 'Milestone Type' },
      { category: 'asset_type', entity_type: 'visual_asset', label: 'Asset Type' },
    ],
  },
  {
    label: 'Pitches',
    groups: [
      { category: 'audience_type', entity_type: 'pitch', label: 'Audience Type' },
      { category: 'pitch_status', entity_type: 'pitch', label: 'Pitch Status' },
      { category: 'material_type', entity_type: 'pitch_material', label: 'Material Type' },
    ],
  },
]

const ALL_GROUPS = NAV_SECTIONS.flatMap(s => s.groups)

function groupKey(g) { return `${g.category}:${g.entity_type}` }

export { NAV_SECTIONS, ALL_GROUPS, groupKey }

export default function OptionsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [allValues, setAllValues] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(searchParams.get('selected') || groupKey(ALL_GROUPS[0]))
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  function load() {
    setLoading(true)
    getLookupValues()
      .then(data => setAllValues(data.lookup_values || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [selected, debouncedSearch])

  const group = ALL_GROUPS.find(g => groupKey(g) === selected) || ALL_GROUPS[0]
  const groupValues = allValues.filter(
    v => v.category === group.category && v.entity_type === group.entity_type
  )

  const filtered = debouncedSearch
    ? groupValues.filter(v =>
        v.display_label.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        v.value.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (v.description && v.description.toLowerCase().includes(debouncedSearch.toLowerCase()))
      )
    : groupValues

  async function handleDelete() {
    if (!deleteConfirm) return
    try {
      const result = await deleteLookupValue(deleteConfirm.id)
      if (result.error) {
        setError(result.error)
      } else {
        load()
      }
    } catch (err) {
      setError(err.message)
    }
    setDeleteConfirm(null)
  }

  async function handleMoveUp(index) {
    if (index === 0) return
    const ids = groupValues.map(v => v.id)
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    await reorderLookupValues(ids)
    load()
  }

  async function handleMoveDown(index) {
    if (index >= groupValues.length - 1) return
    const ids = groupValues.map(v => v.id)
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    await reorderLookupValues(ids)
    load()
  }

  const COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => {
        const idx = groupValues.findIndex(v => v.id === row.id)
        return (
          <ActionMenu items={[
            { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/slate/options/${row.id}/edit`) },
            { label: 'Move Up', icon: 'M7.5 10l4-4 4 4', onClick: () => handleMoveUp(idx) },
            { label: 'Move Down', icon: 'M7.5 5l4 4 4-4', onClick: () => handleMoveDown(idx) },
            { divider: true },
            { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setDeleteConfirm(row) },
          ]} />
        )
      },
    },
    {
      key: 'display_label', label: 'Label', strong: true,
      render: (val, row) => row.css_class
        ? <span className={`badge ${row.css_class}`}>{val}</span>
        : val,
    },
    { key: 'value', label: 'Value', className: 'cell-muted' },
    { key: 'description', label: 'Description', className: 'cell-muted' },
  ]

  const addUrl = `/slate/options/new?category=${encodeURIComponent(group.category)}&entity_type=${encodeURIComponent(group.entity_type)}`

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h1 className="page-title">Options</h1>
          <p className="page-subtitle">{allValues.length > 0 ? `${allValues.length} option${allValues.length !== 1 ? 's' : ''} across ${ALL_GROUPS.length} categories` : 'Manage the choices available in dropdowns across the tool'}</p>
        </div>
        <div className="page-topbar-actions">
          <Link to={addUrl} className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Add Option
          </Link>
        </div>
      </div>

      {error && <Alert variant="error" title={error} />}

      <div className="options-workbench">
        <div className="options-workbench-nav">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <div className="options-nav-section">{section.label}</div>
              {section.groups.map(g => (
                <button
                  key={groupKey(g)}
                  className={`options-nav-item${selected === groupKey(g) ? ' selected' : ''}`}
                  onClick={() => setSelected(groupKey(g))}
                >
                  {g.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="options-workbench-content">
          <h2 className="options-content-title">{group.label}</h2>

          <div className="filter-row-compact">
            <div className="query-bar search-bar-constrained">
              <svg className="query-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7.5" cy="7.5" r="5.5" /><path d="M12 12l4 4" />
              </svg>
              <input className="query-input" placeholder={`Search ${group.label.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="disc-center"><div className="loading-spinner" /></div>
          ) : (
            <DataTable
              data={filtered}
              columns={COLUMNS}
              onRowClick={row => navigate(`/slate/options/${row.id}/edit`)}
              pagination={{ total: filtered.length, page, limit, onPageChange: setPage, onLimitChange: setLimit }}
              emptyState={
                <EmptyState
                  title="No options found"
                  description={debouncedSearch ? 'Try a different search.' : `Add options that will appear in dropdowns for ${group.label.toLowerCase()}.`}
                />
              }
            />
          )}
        </div>
      </div>

      {deleteConfirm && (
        <Modal title="Delete Option" onClose={() => setDeleteConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{deleteConfirm.display_label}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </>
  )
}
