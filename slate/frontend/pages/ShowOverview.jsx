/**
 * Show > Overview — read-only view of the show's identity and current state.
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import StageProgression from '@shared/components/StageProgression'
import { ActionMenu, Modal } from '@shared/components'
import { deleteShow, getLookupValues } from '@slate/api'

export default function ShowOverview({ show, onUpdate }) {
  const navigate = useNavigate()
  const [stages, setStages] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getLookupValues({ category: 'development_stage' }).then(res => {
      setStages(res.lookup_values || [])
    })
  }, [])

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteShow(show.id)
      navigate('/slate/shows')
    } catch (err) {
      console.error('Delete failed:', err)
      setDeleting(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const recentMilestones = (show.milestones || [])
    .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
    .slice(0, 3)

  const actionItems = [
    {
      label: 'Edit',
      icon: 'M13.5 3.5l3 3L5.5 17.5H2.5v-3L13.5 3.5z',
      onClick: () => navigate(`/slate/shows/${show.id}/edit`),
    },
    { divider: true },
    {
      label: 'Delete',
      icon: 'M2 4h11M5 4V2.5h5V4M3.5 4v9a1.5 1.5 0 001.5 1.5h5a1.5 1.5 0 001.5-1.5V4',
      destructive: true,
      onClick: () => setConfirmDelete(true),
    },
  ]

  return (
    <div className="section-stack">
      {/* Hero */}
      <div className="detail-hero">
        <div>
          <h1 className="type-display-1">{show.title}</h1>
          <div className="slate-badge-row">
            {show.medium && (
              <span className={`badge ${show.medium.css_class || 'badge-neutral'}`}>{show.medium.display_label}</span>
            )}
            {show.development_stage && (
              <span className={`badge ${show.development_stage.css_class || 'badge-neutral'}`}>{show.development_stage.display_label}</span>
            )}
            {show.rights_status && (
              <span className={`badge ${show.rights_status.css_class || 'badge-neutral'}`}>{show.rights_status.display_label}</span>
            )}
          </div>
        </div>
        <ActionMenu items={actionItems} />
      </div>

      {/* Stage progression */}
      {stages.length > 0 && show.development_stage && (
        <StageProgression stages={stages} currentValue={show.development_stage.value} />
      )}

      {/* Main + Sidebar */}
      <div className="detail-layout">
        <div className="detail-main">
          {/* Logline */}
          <div className="prose">
            {show.logline || <span className="text-tertiary">No logline yet</span>}
          </div>

          {/* Summary */}
          <div className="prose text-secondary">
            {show.summary || <span className="text-tertiary">No summary yet</span>}
          </div>

          {/* Key Metrics */}
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">Key Metrics</h2>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Cast Size</div>
                <div className="stat-value text-tertiary">&mdash;</div>
                <div className="stat-note">Populated from script</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Runtime</div>
                <div className="stat-value text-tertiary">&mdash;</div>
                <div className="stat-note">Populated from script</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Budget Range</div>
                <div className="stat-value text-tertiary">&mdash;</div>
                <div className="stat-note">Populated from script</div>
              </div>
            </div>
          </div>

          {/* Producing Info */}
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">Producing Info</h2>
            </div>
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 6h24M4 12h24M4 18h16M4 24h12" />
                </svg>
              </div>
              <div className="empty-state-desc">Budget estimate, cast requirements, and technical complexity will appear here after a script is analyzed.</div>
            </div>
          </div>
        </div>

        <div className="detail-sidebar">
          {/* Details */}
          <div className="section-card section-card--compact">
            <div className="section-card-header">
              <h2 className="section-card-title">Details</h2>
            </div>
            <div className="sidebar-field">
              <div className="type-label">Genre</div>
              <div>{show.genre || <span className="text-tertiary">&mdash;</span>}</div>
            </div>
            <div className="sidebar-field">
              <div className="type-label">Medium</div>
              <div>{show.medium?.display_label || <span className="text-tertiary">&mdash;</span>}</div>
            </div>
            <div className="sidebar-field">
              <div className="type-label">Development Stage</div>
              <div>{show.development_stage?.display_label || <span className="text-tertiary">&mdash;</span>}</div>
            </div>
            <div className="sidebar-field">
              <div className="type-label">Rights Status</div>
              <div>{show.rights_status?.display_label || <span className="text-tertiary">&mdash;</span>}</div>
            </div>
          </div>

          {/* Current Script */}
          <div
            className="section-card section-card--compact"
            onClick={() => navigate(`/slate/shows/${show.id}/scripts`)}
          >
            <div className="section-card-header">
              <h2 className="section-card-title">Current Script</h2>
            </div>
            {show.current_script_version ? (
              <div>
                <div>{show.current_script_version.label || show.current_script_version.version_label}</div>
                <div className="text-tertiary">
                  {formatDate(show.current_script_version.uploaded_at || show.current_script_version.created_at)}
                </div>
              </div>
            ) : (
              <div className="text-tertiary">No script uploaded</div>
            )}
          </div>

          {/* Recent Milestones */}
          <div
            className="section-card section-card--compact"
            onClick={() => navigate(`/slate/shows/${show.id}/milestones`)}
          >
            <div className="section-card-header">
              <h2 className="section-card-title">Recent Milestones</h2>
            </div>
            {recentMilestones.length > 0 ? (
              recentMilestones.map((ms, i) => (
                <div key={ms.id || i} className="sidebar-field">
                  <div className="type-label">{formatDate(ms.date || ms.created_at)}</div>
                  <div>{ms.title}</div>
                </div>
              ))
            ) : (
              <div className="text-tertiary">No milestones</div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <Modal
          title="Delete Show"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          }
        >
          <p className="confirm-body">
            Are you sure you want to delete <strong>{show.title}</strong>? This will permanently remove the show and all associated data including scripts, milestones, and visual assets.
          </p>
        </Modal>
      )}
    </div>
  )
}
