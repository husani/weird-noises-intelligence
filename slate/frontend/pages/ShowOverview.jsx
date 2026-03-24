/**
 * Show > Overview — read-only view of the show's identity and current state.
 * Populated from show object + AI-generated show_data when available.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import StageProgression from '@shared/components/StageProgression'
import { ActionMenu, Modal } from '@shared/components'
import { deleteShow, getLookupValues, getShowData, updateShow, reprocessScript } from '@slate/api'

// Medium-aware stage filtering
const THEATRE_STAGES = [
  'early_development', 'internal_read', 'workshop', 'staged_reading', 'table_read',
  'seeking_production', 'in_pre_production', 'in_production', 'running', 'closed',
]
const FILM_TV_STAGES = [
  'early_development', 'internal_read', 'table_read',
  'seeking_production', 'in_pre_production', 'in_production', 'in_post_production', 'released',
]
const THEATRE_MEDIUMS = ['musical', 'play']
const FILM_TV_MEDIUMS = ['screenplay', 'feature_film', 'short_film', 'teleplay', 'limited_series']

function getStagesForMedium(allStages, mediumValue) {
  let allowed
  if (THEATRE_MEDIUMS.includes(mediumValue)) allowed = THEATRE_STAGES
  else if (FILM_TV_MEDIUMS.includes(mediumValue)) allowed = FILM_TV_STAGES
  else return allStages
  return allStages.filter(s => allowed.includes(s.value))
}

export default function ShowOverview({ show, onUpdate }) {
  const navigate = useNavigate()
  const [stages, setStages] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showData, setShowData] = useState(null)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    getLookupValues({ category: 'development_stage' }).then(res => {
      setStages(res.lookup_values || [])
    })
  }, [])

  const loadShowData = useCallback(async () => {
    try {
      const res = await getShowData(show.id)
      setShowData(res)
    } catch (err) {
      console.error('Failed to load show data:', err)
    } finally {
      setLoadingData(false)
    }
  }, [show.id])

  useEffect(() => { loadShowData() }, [loadShowData])

  // Extract data from show_data response
  const dataByType = {}
  if (showData) {
    const allData = [
      ...(showData.script_data || []),
      ...(showData.music_data || []),
      ...(showData.visual_data || []),
    ]
    allData.forEach(d => {
      dataByType[d.data_type] = d
    })
  }

  const castRequirements = dataByType.cast_requirements?.content
  const runtimeEstimate = dataByType.runtime_estimate?.content
  const budgetEstimate = dataByType.budget_estimate?.content
  const comparables = dataByType.comparables?.content
  const contentAdvisories = dataByType.content_advisories?.content
  const loglineDraft = dataByType.logline_draft?.content
  const summaryDraft = dataByType.summary_draft?.content

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

  async function handleUseLogline(text) {
    try {
      await updateShow(show.id, { logline: text })
      onUpdate()
    } catch (err) {
      console.error('Failed to update logline:', err)
    }
  }

  async function handleUseSummary(text) {
    try {
      await updateShow(show.id, { summary: text })
      onUpdate()
    } catch (err) {
      console.error('Failed to update summary:', err)
    }
  }

  async function handleReprocess() {
    if (!show.current_script_version) return
    try {
      await reprocessScript(show.id, show.current_script_version.id)
      onUpdate()
    } catch (err) {
      console.error('Reprocess failed:', err)
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
    ...(show.current_script_version ? [{
      label: 'Regenerate from script',
      icon: 'M1 8a7 7 0 0113-3.5M15 8A7 7 0 012 11.5M15 1v4h-4M1 15v-4h4',
      onClick: handleReprocess,
    }] : []),
    { divider: true },
    {
      label: 'Delete',
      icon: 'M2 4h11M5 4V2.5h5V4M3.5 4v9a1.5 1.5 0 001.5 1.5h5a1.5 1.5 0 001.5-1.5V4',
      destructive: true,
      onClick: () => setConfirmDelete(true),
    },
  ]

  const isProcessing = show.current_script_version?.processing_status === 'processing'

  // Stat values
  const castSize = castRequirements?.recommended_cast_size
  const runtime = runtimeEstimate?.total_minutes
  const budgetRange = budgetEstimate?.estimated_range

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

      {/* Stage progression — filtered by medium */}
      {stages.length > 0 && show.development_stage && (
        <StageProgression
          stages={getStagesForMedium(stages, show.medium?.value)}
          currentValue={show.development_stage.value}
        />
      )}

      {/* Main + Sidebar */}
      <div className="detail-layout">
        <div className="detail-main">
          {/* Logline */}
          <div className="prose">
            {show.logline || <span className="text-tertiary">No logline yet</span>}
          </div>

          {/* Logline drafts */}
          {!show.logline && loglineDraft && Array.isArray(loglineDraft.options) && loglineDraft.options.length > 0 && (
            <div className="section-card section-card--compact section-card--accent-warm">
              <div className="section-card-header">
                <h2 className="section-card-title">Generated Loglines</h2>
                <div className="section-card-meta">Choose one to use</div>
              </div>
              <div className="slate-draft-options">
                {loglineDraft.options.map((opt, i) => (
                  <div key={i} className="slate-draft-option">
                    <div className="prose">{typeof opt === 'string' ? opt : opt.text}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleUseLogline(typeof opt === 'string' ? opt : opt.text)}>
                      Use this
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="prose text-secondary">
            {show.summary || <span className="text-tertiary">No summary yet</span>}
          </div>

          {/* Summary drafts */}
          {!show.summary && summaryDraft && Array.isArray(summaryDraft.options) && summaryDraft.options.length > 0 && (
            <div className="section-card section-card--compact section-card--accent-warm">
              <div className="section-card-header">
                <h2 className="section-card-title">Generated Summaries</h2>
                <div className="section-card-meta">Choose one to use</div>
              </div>
              <div className="slate-draft-options">
                {summaryDraft.options.map((opt, i) => (
                  <div key={i} className="slate-draft-option">
                    <div className="prose">{typeof opt === 'string' ? opt : opt.text}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleUseSummary(typeof opt === 'string' ? opt : opt.text)}>
                      Use this
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparables */}
          {comparables && Array.isArray(comparables.items) && comparables.items.length > 0 && (
            <div className="section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">Comparables</h2>
              </div>
              <div className="section-stack">
                {comparables.items.map((comp, i) => (
                  <div key={i} className="slate-comparable">
                    <div className="slate-comparable-header">
                      <span className="slate-comparable-title">{comp.title}</span>
                      {comp.relationship && <span className="badge badge-neutral">{comp.relationship}</span>}
                    </div>
                    {comp.reasoning && <div className="prose text-secondary">{comp.reasoning}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Metrics */}
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">Key Metrics</h2>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Cast Size</div>
                <div className={`stat-value${!castSize ? ' text-tertiary' : ''}`}>
                  {castSize || '\u2014'}
                </div>
                <div className="stat-note">{castSize ? 'From script analysis' : 'Populated from script'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Runtime</div>
                <div className={`stat-value${!runtime ? ' text-tertiary' : ''}`}>
                  {runtime ? `${runtime} min` : '\u2014'}
                </div>
                <div className="stat-note">{runtime ? 'Estimated from script' : 'Populated from script'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Budget Range</div>
                <div className={`stat-value${!budgetRange ? ' text-tertiary' : ''}`}>
                  {budgetRange || '\u2014'}
                </div>
                <div className="stat-note">{budgetRange ? 'Estimated from script' : 'Populated from script'}</div>
              </div>
            </div>
          </div>

          {/* Content Advisories */}
          {contentAdvisories && Array.isArray(contentAdvisories.items) && contentAdvisories.items.length > 0 && (
            <div className="section-stack">
              {contentAdvisories.items.map((advisory, i) => {
                const severity = (advisory.severity || '').toLowerCase()
                const alertClass = (severity === 'moderate' || severity === 'strong')
                  ? 'alert-warning' : 'alert-info'
                return (
                  <div key={i} className={`alert ${alertClass}`}>
                    <svg className="alert-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      {alertClass === 'alert-warning'
                        ? <path d="M10 2L1 18h18L10 2zM10 8v4M10 14.5v.5" />
                        : <><circle cx="10" cy="10" r="8" /><path d="M10 6v5M10 13.5v.5" /></>
                      }
                    </svg>
                    <div className="alert-content">
                      <div className="alert-title">{advisory.category || advisory.type}</div>
                      <div>{advisory.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Producing Info */}
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">Producing Info</h2>
            </div>
            {(budgetEstimate || castRequirements) ? (
              <div className="section-stack">
                {budgetEstimate?.content?.budget_factors && (
                  <div>
                    <div className="type-label">Budget Factors</div>
                    <ul className="slate-producing-list">
                      {(Array.isArray(budgetEstimate.content.budget_factors)
                        ? budgetEstimate.content.budget_factors
                        : []
                      ).map((factor, i) => (
                        <li key={i} className="text-secondary">{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {castRequirements && (
                  <div>
                    <div className="type-label">Cast Requirements</div>
                    <div className="prose text-secondary">
                      {castRequirements.summary || castRequirements.details || (
                        <span>
                          {castRequirements.recommended_cast_size && `Recommended cast size: ${castRequirements.recommended_cast_size}`}
                          {castRequirements.minimum_cast_size && ` (minimum: ${castRequirements.minimum_cast_size})`}
                        </span>
                      )}
                    </div>
                    {castRequirements.notes && (
                      <div className="prose text-secondary">{castRequirements.notes}</div>
                    )}
                  </div>
                )}
                {budgetEstimate?.content?.technical_complexity && (
                  <div>
                    <div className="type-label">Technical Complexity</div>
                    <div className="prose text-secondary">{budgetEstimate.content.technical_complexity}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 6h24M4 12h24M4 18h16M4 24h12" />
                  </svg>
                </div>
                <div className="empty-state-desc">Budget estimate, cast requirements, and technical complexity will appear here after a script is analyzed.</div>
              </div>
            )}
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
                <div className="slate-script-status-row">
                  <span>{show.current_script_version.label || show.current_script_version.version_label}</span>
                  {isProcessing && (
                    <span className="status status-warm">
                      <span className="status-dot pulse" />
                      Processing
                    </span>
                  )}
                </div>
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
