import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listSources, deleteSource, reorderSources } from '@producers/api'
import { ActionMenu, Alert, DataTable, EmptyState, Modal } from '@shared/components'

export default function SourcesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  function load() {
    setLoading(true)
    setError(null)
    listSources()
      .then(data => setItems(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleDelete() {
    if (!deleteConfirm) return
    try {
      await deleteSource(deleteConfirm.id)
      setDeleteConfirm(null)
      load()
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(null)
    }
  }

  async function handleMove(index, direction) {
    const next = [...items]
    const swapIdx = index + direction
    if (swapIdx < 0 || swapIdx >= next.length) return
    ;[next[index], next[swapIdx]] = [next[swapIdx], next[index]]
    setItems(next)
    await reorderSources(next.map(s => s.id))
  }

  const COLUMNS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/data-sources/${row.id}/edit`) },
          { divider: true },
          { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setDeleteConfirm(row) },
        ]} />
      ),
    },
    {
      key: '_order', label: '', sortable: false, className: 'th-reorder',
      render: (_, row) => {
        const idx = items.indexOf(row)
        return (
          <div className="source-reorder">
            <button className="btn-icon" onClick={e => { e.stopPropagation(); handleMove(idx, -1) }}
              disabled={idx === 0} title="Move up">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 7l3-4 3 4" />
              </svg>
            </button>
            <button className="btn-icon" onClick={e => { e.stopPropagation(); handleMove(idx, 1) }}
              disabled={idx === items.length - 1} title="Move down">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 3l3 4 3-4" />
              </svg>
            </button>
          </div>
        )
      },
    },
    {
      key: 'name', label: 'Name', strong: true,
    },
    {
      key: 'url', label: 'URL',
      render: v => v
        ? <a href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noopener noreferrer"
            className="link link-external" onClick={e => e.stopPropagation()}>
            {v.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </a>
        : <span className="cell-muted">&mdash;</span>,
    },
    {
      key: 'description', label: 'Description', className: 'cell-muted',
    },
  ]

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h1 className="page-title">Data Sources</h1>
          <p className="page-subtitle">{items.length > 0 ? `${items.length} source${items.length !== 1 ? 's' : ''}` : 'Research sources for producer dossiers'}</p>
        </div>
        <div className="page-topbar-actions">
          <Link to="/producers/data-sources/new" className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Add Data Source
          </Link>
        </div>
      </div>

      {error && <Alert variant="error" title={error} />}

      {loading ? (
        <div className="disc-center"><div className="loading-spinner" /></div>
      ) : (
        <DataTable
          data={items}
          columns={COLUMNS}
          onRowClick={row => navigate(`/producers/data-sources/${row.id}`)}
          emptyState={
            <EmptyState
              title="No data sources"
              description="Add data sources so the AI knows where to look when building producer dossiers."
            />
          }
        />
      )}

      {deleteConfirm && (
        <Modal title="Delete Data Source" onClose={() => setDeleteConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>&ldquo;{deleteConfirm.name}&rdquo;</strong>? The AI will no longer consult this source for dossier research.
          </p>
        </Modal>
      )}
    </>
  )
}
