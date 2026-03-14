import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getSource, deleteSource } from '@producers/api'
import { ActionMenu, Alert, Modal } from '@shared/components'

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function SourceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [source, setSource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getSource(id)
      .then(data => {
        if (data.error) setError(data.error)
        else setSource(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    try {
      await deleteSource(id)
      navigate('/producers/data-sources')
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(false)
    }
  }

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  if (error) {
    return <Alert variant="error" title={error} />
  }

  if (!source) return null

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/data-sources" className="breadcrumb">Data Sources</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        <span className="breadcrumb-current">{source.name}</span>
      </div>

      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{source.name}</h1>
          <ActionMenu items={[
            { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/data-sources/${id}/edit`) },
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
              <div className="type-label">URL</div>
              {source.url
                ? <a
                    href={source.url.startsWith('http') ? source.url : `https://${source.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-external"
                  >
                    {source.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                : <div className="cell-muted">&mdash;</div>}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Priority</div>
              <div>{source.sort_order + 1}</div>
            </div>

            <div className="sidebar-field">
              <div className="type-label">Created</div>
              {source.created_at
                ? <div className="cell-muted">{relativeTime(source.created_at)}</div>
                : <div className="cell-muted">&mdash;</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="type-label">Description</div>
          <div className="prose">{source.description || 'No description'}</div>
        </div>
      </div>

      {deleteConfirm && (
        <Modal title="Delete Data Source" onClose={() => setDeleteConfirm(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            <button className="btn btn-destructive" onClick={handleDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>&ldquo;{source.name}&rdquo;</strong>? The AI will no longer consult this source for dossier research.
          </p>
        </Modal>
      )}
    </>
  )
}
