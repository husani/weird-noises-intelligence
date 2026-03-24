/**
 * Show > Overview — read-only view of the show's identity and current state.
 * Populated from show object + domain table APIs for AI-generated data.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import StageProgression from '@shared/components/StageProgression'
import { ActionMenu, Modal } from '@shared/components'
import {
  deleteShow, getLookupValues, updateShow, reprocessScript,
  getCastRequirements, getRuntimeEstimate, getBudgetEstimate,
  listComparables, listAdvisories, listLoglineDrafts, listSummaryDrafts,
} from '@slate/api'

/**
 * Filter stages by medium using the applies_to field from lookup values.
 * If applies_to is null, the stage applies to all mediums.
 * If applies_to is an array, the stage only applies to those mediums.
 */
function getStagesForMedium(allStages, mediumValue) {
  if (!mediumValue) return allStages
  return allStages.filter(s =>
    !s.applies_to || s.applies_to.includes(mediumValue)
  )
}

export default function ShowOverview({ show, onUpdate }) {
  const navigate = useNavigate()
  const [stages, setStages] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // Domain data state
  const [castReq, setCastReq] = useState(null)
  const [runtime, setRuntime] = useState(null)
  const [budget, setBudget] = useState(null)
  const [comparables, setComparables] = useState([])
  const [advisories, setAdvisories] = useState([])
  const [loglineDrafts, setLoglineDrafts] = useState([])
  const [summaryDrafts, setSummaryDrafts] = useState([])

  useEffect(() => {
    getLookupValues({ category: 'development_stage' }).then(res => {
      setStages(res.lookup_values || [])
    })
  }, [])

  const loadDomainData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        getCastRequirements(show.id),
        getRuntimeEstimate(show.id),
        getBudgetEstimate(show.id),
        listComparables(show.id),
        listAdvisories(show.id),
        listLoglineDrafts(show.id),
        listSummaryDrafts(show.id),
      ])

      const [cast, rt, bud, comp, adv, log, sum] = results
      if (cast.status === 'fulfilled') setCastReq(cast.value)
      if (rt.status === 'fulfilled') setRuntime(rt.value)
      if (bud.status === 'fulfilled') setBudget(bud.value)
      if (comp.status === 'fulfilled') setComparables(comp.value.comparables || [])
      if (adv.status === 'fulfilled') setAdvisories(adv.value.advisories || [])
      if (log.status === 'fulfilled') setLoglineDrafts(log.value.drafts || [])
      if (sum.status === 'fulfilled') setSummaryDrafts(sum.value.drafts || [])
    } catch (err) {
      console.error('Failed to load domain data:', err)
    } finally {
      setLoadingData(false)
    }
  }, [show.id])

  useEffect(() => { loadDomainData() }, [loadDomainData])

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

  // Stat values from domain entities
  const castSize = castReq?.recommended_cast_size
  const runtimeMinutes = runtime?.total_minutes
  const budgetRange = budget?.estimated_range

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
          {!show.logline && loglineDrafts.length > 0 && (
            <div className="section-card section-card--compact section-card--accent-warm">
              <div className="section-card-header">
                <h2 className="section-card-title">Generated Loglines</h2>
                <div className="section-card-meta">Choose one to use</div>
              </div>
              <div className="slate-draft-options">
                {loglineDrafts.map(draft => (
                  <div key={draft.id} className="slate-draft-option">
                    <div className="prose">{draft.text}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleUseLogline(draft.text)}>
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
          {!show.summary && summaryDrafts.length > 0 && (
            <div className="section-card section-card--compact section-card--accent-warm">
              <div className="section-card-header">
                <h2 className="section-card-title">Generated Summaries</h2>
                <div className="section-card-meta">Choose one to use</div>
              </div>
              <div className="slate-draft-options">
                {summaryDrafts.map(draft => (
                  <div key={draft.id} className="slate-draft-option">
                    <div className="prose">{draft.text}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleUseSummary(draft.text)}>
                      Use this
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparables */}
          {comparables.length > 0 && (
            <div className="section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">Comparables</h2>
              </div>
              <div className="section-stack">
                {comparables.map(comp => (
                  <div key={comp.id} className="slate-comparable">
                    <div className="slate-comparable-header">
                      <span className="slate-comparable-title">{comp.title}</span>
                      {comp.relationship_type && <span className="badge badge-neutral">{comp.relationship_type}</span>}
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
                <div className={`stat-value${!runtimeMinutes ? ' text-tertiary' : ''}`}>
                  {runtimeMinutes ? `${runtimeMinutes} min` : '\u2014'}
                </div>
                <div className="stat-note">{runtimeMinutes ? 'Estimated from script' : 'Populated from script'}</div>
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
          {advisories.length > 0 && (
            <div className="section-stack">
              {advisories.map(advisory => {
                const severity = (advisory.severity || '').toLowerCase()
                const alertClass = (severity === 'moderate' || severity === 'strong')
                  ? 'alert-warning' : 'alert-info'
                return (
                  <div key={advisory.id} className={`alert ${alertClass}`}>
                    <svg className="alert-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      {alertClass === 'alert-warning'
                        ? <path d="M10 2L1 18h18L10 2zM10 8v4M10 14.5v.5" />
                        : <><circle cx="10" cy="10" r="8" /><path d="M10 6v5M10 13.5v.5" /></>
                      }
                    </svg>
                    <div className="alert-content">
                      <div className="alert-title">{advisory.category}</div>
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
            {(budget || castReq) ? (
              <div className="section-stack">
                {budget?.budget_factors && Array.isArray(budget.budget_factors) && budget.budget_factors.length > 0 && (
                  <div>
                    <div className="type-label">Budget Factors</div>
                    <ul className="slate-producing-list">
                      {budget.budget_factors.map((factor, i) => (
                        <li key={i} className="text-secondary">{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {castReq && (
                  <div>
                    <div className="type-label">Cast Requirements</div>
                    <div className="prose text-secondary">
                      {castReq.summary || castReq.details || (
                        <span>
                          {castReq.recommended_cast_size && `Recommended cast size: ${castReq.recommended_cast_size}`}
                          {castReq.minimum_cast_size && ` (minimum: ${castReq.minimum_cast_size})`}
                        </span>
                      )}
                    </div>
                    {castReq.notes && (
                      <div className="prose text-secondary">{castReq.notes}</div>
                    )}
                  </div>
                )}
                {budget?.technical_complexity && (
                  <div>
                    <div className="type-label">Technical Complexity</div>
                    <div className="prose text-secondary">{budget.technical_complexity}</div>
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
